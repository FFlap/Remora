import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertCanEditDeck, assertCanReadDeck } from "./lib/access";
import { ensureCurrentUser, getCurrentUser } from "./lib/auth";
import { assetDocValidator, assetWithResolvedUrlValidator } from "./lib/constants";

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await ensureCurrentUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveUploadedImage = mutation({
  args: {
    storageId: v.id("_storage"),
    deckId: v.optional(v.id("decks")),
    mime: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  returns: v.object({
    assetId: v.id("assets"),
    url: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const user = await ensureCurrentUser(ctx);
    const normalizedMime = args.mime?.trim().toLowerCase();

    if (normalizedMime && !normalizedMime.startsWith("image/")) {
      throw new Error("Only image uploads are allowed");
    }

    if (args.width !== undefined && (!Number.isFinite(args.width) || args.width <= 0)) {
      throw new Error("Invalid image width");
    }

    if (args.height !== undefined && (!Number.isFinite(args.height) || args.height <= 0)) {
      throw new Error("Invalid image height");
    }

    if (args.deckId) {
      await assertCanEditDeck(ctx, args.deckId);
    }

    const url = await ctx.storage.getUrl(args.storageId);

    const assetId = await ctx.db.insert("assets", {
      ownerUserId: user._id,
      deckId: args.deckId,
      type: "image",
      storageId: args.storageId,
      url: url ?? undefined,
      metadata: {
        mime: normalizedMime,
        width: args.width,
        height: args.height,
      },
      createdAt: Date.now(),
    });

    return {
      assetId,
      url,
    };
  },
});

export const getAsset = query({
  args: { assetId: v.id("assets") },
  returns: assetWithResolvedUrlValidator,
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) {
      throw new Error("Asset not found");
    }

    if (asset.deckId) {
      await assertCanReadDeck(ctx, asset.deckId);
    } else {
      const user = await getCurrentUser(ctx);
      if (!user || user._id !== asset.ownerUserId) {
        throw new Error("Forbidden");
      }
    }

    const resolvedUrl = asset.storageId
      ? (await ctx.storage.getUrl(asset.storageId)) ?? null
      : asset.url ?? null;

    return {
      ...asset,
      resolvedUrl,
    };
  },
});

export const listByDeck = query({
  args: { deckId: v.id("decks") },
  returns: v.array(assetDocValidator),
  handler: async (ctx, args) => {
    await assertCanReadDeck(ctx, args.deckId);
    return await ctx.db
      .query("assets")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .order("desc")
      .collect();
  },
});

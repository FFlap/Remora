import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertCanEditDeck, getDeckOrThrow } from "./lib/access";
import { ensureCurrentUser, getCurrentUser, normalizeEmail } from "./lib/auth";

export const requestAccess = mutation({
  args: {
    deckId: v.id("decks"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ensureCurrentUser(ctx);
    const deck = await getDeckOrThrow(ctx, args.deckId);

    if (deck.visibility !== "whitelist") {
      throw new Error("This deck does not accept access requests");
    }

    if (deck.ownerUserId === user._id) {
      throw new Error("Owners do not need access requests");
    }

    if (deck.whitelistEmails.includes(normalizeEmail(user.email))) {
      throw new Error("You already have access");
    }

    const existing = await ctx.db
      .query("deckAccessRequests")
      .withIndex("by_requester_and_deck", (q) =>
        q.eq("requesterUserId", user._id).eq("deckId", deck._id),
      )
      .first();

    const now = Date.now();

    if (existing) {
      if (existing.status === "pending") {
        return existing._id;
      }

      await ctx.db.patch(existing._id, {
        status: "pending",
        message: args.message?.trim(),
        updatedAt: now,
        resolvedByUserId: undefined,
      });
      return existing._id;
    }

    return await ctx.db.insert("deckAccessRequests", {
      deckId: deck._id,
      requesterUserId: user._id,
      requesterEmail: normalizeEmail(user.email),
      message: args.message?.trim(),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const myRequestStatus = query({
  args: {
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return null;
    }

    return await ctx.db
      .query("deckAccessRequests")
      .withIndex("by_requester_and_deck", (q) =>
        q.eq("requesterUserId", user._id).eq("deckId", args.deckId),
      )
      .first();
  },
});

export const listForDeckOwner = query({
  args: {
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    await assertCanEditDeck(ctx, args.deckId);

    return await ctx.db
      .query("deckAccessRequests")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .order("desc")
      .collect();
  },
});

export const resolveRequest = mutation({
  args: {
    requestId: v.id("deckAccessRequests"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const resolver = await ensureCurrentUser(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    const { deck } = await assertCanEditDeck(ctx, request.deckId);
    const now = Date.now();

    await ctx.db.patch(request._id, {
      status: args.decision,
      updatedAt: now,
      resolvedByUserId: resolver._id,
    });

    if (args.decision === "approved") {
      const whitelistEmails = Array.from(
        new Set([...deck.whitelistEmails, normalizeEmail(request.requesterEmail)]),
      );
      await ctx.db.patch(deck._id, {
        whitelistEmails,
        updatedAt: now,
      });
    }
  },
});

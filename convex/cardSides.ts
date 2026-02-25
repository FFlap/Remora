import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertCanEditDeck, assertCanReadDeck } from "./lib/access";
import { cardSideDocValidator, editModeValidator, sideModelValidator } from "./lib/constants";
import { createDefaultSideModel } from "./lib/sideModel";

const MAX_SIDE_MODEL_SIZE_BYTES = 512_000; // 500 KB

export const listByCard = query({
  args: { cardId: v.id("cards") },
  returns: v.array(cardSideDocValidator),
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card) {
      throw new Error("Card not found");
    }
    await assertCanReadDeck(ctx, card.deckId);

    return await ctx.db
      .query("cardSides")
      .withIndex("by_card_index", (q) => q.eq("cardId", args.cardId))
      .collect();
  },
});

export const saveSide = mutation({
  args: {
    cardId: v.id("cards"),
    index: v.number(),
    sideId: v.optional(v.id("cardSides")),
    sideModel: sideModelValidator,
    lastEditedMode: editModeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card) {
      throw new Error("Card not found");
    }

    await assertCanEditDeck(ctx, card.deckId);

    if (JSON.stringify(args.sideModel).length > MAX_SIDE_MODEL_SIZE_BYTES) {
      throw new Error("Side content is too large");
    }

    let existing = null;
    if (args.sideId) {
      const byId = await ctx.db.get(args.sideId);
      if (byId && byId.cardId === args.cardId) {
        existing = byId;
      }
    }

    if (!existing) {
      existing = await ctx.db
        .query("cardSides")
        .withIndex("by_card_index", (q) => q.eq("cardId", args.cardId).eq("index", args.index))
        .first();
    }

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(existing.deckId !== card.deckId ? { deckId: card.deckId } : {}),
        sideModel: args.sideModel,
        updatedAt: now,
      });
    } else {
      // Ignore stale saves for deleted/reindexed sides.
      return null;
    }

    await ctx.db.patch(card._id, {
      updatedAt: now,
      ...(card.lastEditedMode !== args.lastEditedMode
        ? { lastEditedMode: args.lastEditedMode }
        : {}),
    });
    return null;
  },
});

export const addSide = mutation({
  args: {
    cardId: v.id("cards"),
    afterIndex: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card) {
      throw new Error("Card not found");
    }

    await assertCanEditDeck(ctx, card.deckId);

    const sides = await ctx.db
      .query("cardSides")
      .withIndex("by_card_index", (q) => q.eq("cardId", args.cardId))
      .collect();

    const insertAfter = args.afterIndex ?? (sides.length > 0 ? sides[sides.length - 1].index : -1);
    const targetIndex = insertAfter + 1;

    const shiftTargets = [...sides].filter((side) => side.index >= targetIndex);
    shiftTargets.sort((a, b) => b.index - a.index);

    for (const side of shiftTargets) {
      await ctx.db.patch(side._id, {
        index: side.index + 1,
      });
    }

    const now = Date.now();

    await ctx.db.insert("cardSides", {
      deckId: card.deckId,
      cardId: args.cardId,
      index: targetIndex,
      sideModel: createDefaultSideModel(String(targetIndex + 1)),
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(card._id, { updatedAt: now });
    return null;
  },
});

export const deleteSide = mutation({
  args: {
    cardId: v.id("cards"),
    index: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card) {
      throw new Error("Card not found");
    }

    await assertCanEditDeck(ctx, card.deckId);

    const sides = await ctx.db
      .query("cardSides")
      .withIndex("by_card_index", (q) => q.eq("cardId", args.cardId))
      .collect();

    if (sides.length <= 1) {
      throw new Error("Card must have at least one side");
    }

    const sideToDelete = sides.find((side) => side.index === args.index);
    if (!sideToDelete) {
      throw new Error("Side not found");
    }

    await ctx.db.delete(sideToDelete._id);

    const toShift = sides
      .filter((side) => side.index > args.index)
      .sort((a, b) => a.index - b.index);

    for (const side of toShift) {
      await ctx.db.patch(side._id, {
        index: side.index - 1,
      });
    }

    const now = Date.now();
    await ctx.db.patch(card._id, { updatedAt: now });
    return null;
  },
});

export const reorder = mutation({
  args: {
    cardId: v.id("cards"),
    orderedSideIds: v.array(v.id("cardSides")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card) {
      throw new Error("Card not found");
    }

    await assertCanEditDeck(ctx, card.deckId);

    const sides = await ctx.db
      .query("cardSides")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    const sideSet = new Set(sides.map((side) => side._id));
    const orderedSet = new Set(args.orderedSideIds);
    if (orderedSet.size !== args.orderedSideIds.length || orderedSet.size !== sideSet.size) {
      throw new Error("Invalid or incomplete side ordering");
    }

    for (const sideId of orderedSet) {
      if (!sideSet.has(sideId)) {
        throw new Error("Invalid or incomplete side ordering");
      }
    }

    const now = Date.now();
    await Promise.all(
      args.orderedSideIds.map((sideId, index) =>
        ctx.db.patch(sideId, {
          index,
          updatedAt: now,
        }),
      ),
    );
    await ctx.db.patch(card._id, { updatedAt: now });
    return null;
  },
});

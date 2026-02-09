import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { editModeValidator, sideIRValidator } from "./lib/constants";
import { assertCanEditDeck, assertCanReadDeck } from "./lib/access";
import { createDefaultSideIR } from "./lib/sideIR";

export const listByCard = query({
  args: { cardId: v.id("cards") },
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
    sideIR: sideIRValidator,
    lastEditedMode: editModeValidator,
  },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card) {
      throw new Error("Card not found");
    }

    await assertCanEditDeck(ctx, card.deckId);

    const existing = await ctx.db
      .query("cardSides")
      .withIndex("by_card_index", (q) => q.eq("cardId", args.cardId).eq("index", args.index))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        sideIR: args.sideIR,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("cardSides", {
        cardId: args.cardId,
        index: args.index,
        sideIR: args.sideIR,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(card._id, {
      lastEditedMode: args.lastEditedMode,
      updatedAt: now,
    });

    await ctx.db.patch(card.deckId, { updatedAt: now });
  },
});

export const addSide = mutation({
  args: {
    cardId: v.id("cards"),
    afterIndex: v.optional(v.number()),
  },
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

    const insertAfter =
      args.afterIndex ?? (sides.length > 0 ? sides[sides.length - 1].index : -1);
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
      cardId: args.cardId,
      index: targetIndex,
      sideIR: createDefaultSideIR(String(targetIndex + 1)),
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(card._id, { updatedAt: now });
    await ctx.db.patch(card.deckId, { updatedAt: now });
  },
});

export const deleteSide = mutation({
  args: {
    cardId: v.id("cards"),
    index: v.number(),
  },
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
    await ctx.db.patch(card.deckId, { updatedAt: now });
  },
});

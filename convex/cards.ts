import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertCanEditDeck, assertCanReadDeck } from "./lib/access";
import { cardDocValidator, editorCardPayloadValidator } from "./lib/constants";
import { createDefaultSideModel } from "./lib/sideModel";

export const create = mutation({
  args: {
    deckId: v.id("decks"),
    sectionId: v.id("sections"),
  },
  returns: v.id("cards"),
  handler: async (ctx, args) => {
    await assertCanEditDeck(ctx, args.deckId);

    const section = await ctx.db.get(args.sectionId);
    if (!section || section.deckId !== args.deckId) {
      throw new Error("Section not found");
    }

    const last = await ctx.db
      .query("cards")
      .withIndex("by_section_order", (q) => q.eq("sectionId", args.sectionId))
      .order("desc")
      .first();

    const now = Date.now();
    const cardId = await ctx.db.insert("cards", {
      deckId: args.deckId,
      sectionId: args.sectionId,
      order: last ? last.order + 1 : 0,
      createdAt: now,
      updatedAt: now,
      lastEditedMode: "quick",
    });

    await ctx.db.insert("cardSides", {
      cardId,
      index: 0,
      sideModel: createDefaultSideModel("1"),
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("cardSides", {
      cardId,
      index: 1,
      sideModel: createDefaultSideModel("2"),
      createdAt: now,
      updatedAt: now,
    });

    return cardId;
  },
});

export const listByDeck = query({
  args: { deckId: v.id("decks") },
  returns: v.array(cardDocValidator),
  handler: async (ctx, args) => {
    await assertCanReadDeck(ctx, args.deckId);
    return await ctx.db
      .query("cards")
      .withIndex("by_deck_order", (q) => q.eq("deckId", args.deckId))
      .collect();
  },
});

export const getEditorCard = query({
  args: { cardId: v.id("cards") },
  returns: editorCardPayloadValidator,
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card) {
      return null;
    }

    await assertCanEditDeck(ctx, card.deckId);

    const sides = await ctx.db
      .query("cardSides")
      .withIndex("by_card_index", (q) => q.eq("cardId", args.cardId))
      .collect();

    return {
      card,
      sides,
    };
  },
});

export const reorderInSection = mutation({
  args: {
    sectionId: v.id("sections"),
    orderedCardIds: v.array(v.id("cards")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new Error("Section not found");
    }

    await assertCanEditDeck(ctx, section.deckId);

    const cards = await ctx.db
      .query("cards")
      .withIndex("by_section", (q) => q.eq("sectionId", section._id))
      .collect();

    const cardSet = new Set(cards.map((c) => c._id));
    const orderedSet = new Set(args.orderedCardIds);
    if (orderedSet.size !== args.orderedCardIds.length || orderedSet.size !== cardSet.size) {
      throw new Error("Invalid or incomplete card ordering");
    }

    for (const id of orderedSet) {
      if (!cardSet.has(id)) {
        throw new Error("Invalid or incomplete card ordering");
      }
    }

    await Promise.all(
      args.orderedCardIds.map((cardId, index) =>
        ctx.db.patch(cardId, {
          order: index,
          updatedAt: Date.now(),
        }),
      ),
    );
    return null;
  },
});

export const moveToSection = mutation({
  args: {
    cardId: v.id("cards"),
    sectionId: v.id("sections"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card) {
      throw new Error("Card not found");
    }

    const targetSection = await ctx.db.get(args.sectionId);
    if (!targetSection) {
      throw new Error("Target section not found");
    }

    if (targetSection.deckId !== card.deckId) {
      throw new Error("Cannot move card to another deck");
    }

    await assertCanEditDeck(ctx, card.deckId);

    const last = await ctx.db
      .query("cards")
      .withIndex("by_section_order", (q) => q.eq("sectionId", targetSection._id))
      .order("desc")
      .first();

    await ctx.db.patch(card._id, {
      sectionId: targetSection._id,
      order: last ? last.order + 1 : 0,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const remove = mutation({
  args: { cardId: v.id("cards") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card) {
      throw new Error("Card not found");
    }

    await assertCanEditDeck(ctx, card.deckId);

    const sides = await ctx.db
      .query("cardSides")
      .withIndex("by_card", (q) => q.eq("cardId", card._id))
      .collect();
    await Promise.all(sides.map((side) => ctx.db.delete(side._id)));

    await ctx.db.delete(card._id);
    return null;
  },
});

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertCanEditDeck, assertCanReadDeck } from "./lib/access";
import { sectionDocValidator } from "./lib/constants";

export const listByDeck = query({
  args: { deckId: v.id("decks") },
  returns: v.array(sectionDocValidator),
  handler: async (ctx, args) => {
    await assertCanReadDeck(ctx, args.deckId);
    return await ctx.db
      .query("sections")
      .withIndex("by_deck_order", (q) => q.eq("deckId", args.deckId))
      .collect();
  },
});

export const create = mutation({
  args: {
    deckId: v.id("decks"),
    title: v.string(),
  },
  returns: v.id("sections"),
  handler: async (ctx, args) => {
    await assertCanEditDeck(ctx, args.deckId);

    const last = await ctx.db
      .query("sections")
      .withIndex("by_deck_order", (q) => q.eq("deckId", args.deckId))
      .order("desc")
      .first();

    const sectionId = await ctx.db.insert("sections", {
      deckId: args.deckId,
      title: args.title.trim() || "New section",
      order: last ? last.order + 1 : 0,
    });

    return sectionId;
  },
});

export const rename = mutation({
  args: {
    sectionId: v.id("sections"),
    title: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new Error("Section not found");
    }
    await assertCanEditDeck(ctx, section.deckId);
    await ctx.db.patch(args.sectionId, { title: args.title.trim() || "Untitled" });
    return null;
  },
});

export const reorder = mutation({
  args: {
    deckId: v.id("decks"),
    orderedSectionIds: v.array(v.id("sections")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertCanEditDeck(ctx, args.deckId);

    const sections = await ctx.db
      .query("sections")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .collect();

    const sectionSet = new Set(sections.map((s) => s._id));
    const orderedSet = new Set(args.orderedSectionIds);
    if (
      orderedSet.size !== args.orderedSectionIds.length ||
      orderedSet.size !== sectionSet.size
    ) {
      throw new Error("Invalid or incomplete section ordering");
    }

    for (const id of orderedSet) {
      if (!sectionSet.has(id)) {
        throw new Error("Invalid or incomplete section ordering");
      }
    }

    await Promise.all(
      args.orderedSectionIds.map((sectionId, index) =>
        ctx.db.patch(sectionId, {
          order: index,
        }),
      ),
    );
    return null;
  },
});

export const remove = mutation({
  args: { sectionId: v.id("sections") },
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

    for (const card of cards) {
      const sides = await ctx.db
        .query("cardSides")
        .withIndex("by_card", (q) => q.eq("cardId", card._id))
        .collect();
      await Promise.all(sides.map((side) => ctx.db.delete(side._id)));
      await ctx.db.delete(card._id);
    }

    await ctx.db.delete(section._id);
    return null;
  },
});

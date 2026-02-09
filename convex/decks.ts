import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  assertCanEditDeck,
  getDeckOrThrow,
  getDeckReadDecision,
} from "./lib/access";
import { ensureCurrentUser, getCurrentUser, normalizeEmail } from "./lib/auth";
import { createDefaultSideIR } from "./lib/sideIR";
import { deckVisibilityValidator } from "./lib/constants";

async function loadDeckTree(ctx: any, deckId: Id<"decks">) {
  const sections = await ctx.db
    .query("sections")
    .withIndex("by_deck_order", (q: any) => q.eq("deckId", deckId))
    .collect();

  const sectionResults = await Promise.all(
    sections.map(async (section: any) => {
      const cards = await ctx.db
        .query("cards")
        .withIndex("by_section_order", (q: any) => q.eq("sectionId", section._id))
        .collect();

      const cardsWithSides = await Promise.all(
        cards.map(async (card: any) => {
          const sides = await ctx.db
            .query("cardSides")
            .withIndex("by_card_index", (q: any) => q.eq("cardId", card._id))
            .collect();
          return {
            ...card,
            sides,
          };
        }),
      );

      return {
        ...section,
        cards: cardsWithSides,
      };
    }),
  );

  return sectionResults;
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    return await ctx.db
      .query("decks")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", user._id))
      .order("desc")
      .collect();
  },
});

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("decks")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .order("desc")
      .take(20);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ensureCurrentUser(ctx);
    const now = Date.now();

    const deckId = await ctx.db.insert("decks", {
      ownerUserId: user._id,
      title: args.title.trim(),
      description: (args.description ?? "").trim(),
      visibility: "private",
      whitelistEmails: [normalizeEmail(user.email)].filter(Boolean),
      createdAt: now,
      updatedAt: now,
    });

    const sectionId = await ctx.db.insert("sections", {
      deckId,
      title: "Section 1",
      order: 0,
    });

    const cardId = await ctx.db.insert("cards", {
      deckId,
      sectionId,
      order: 0,
      createdAt: now,
      updatedAt: now,
      lastEditedMode: "quick",
    });

    await ctx.db.insert("cardSides", {
      cardId,
      index: 0,
      sideIR: createDefaultSideIR("1"),
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("cardSides", {
      cardId,
      index: 1,
      sideIR: createDefaultSideIR("2"),
      createdAt: now,
      updatedAt: now,
    });

    return { deckId, sectionId, cardId };
  },
});

export const updateMeta = mutation({
  args: {
    deckId: v.id("decks"),
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    await assertCanEditDeck(ctx, args.deckId);
    await ctx.db.patch(args.deckId, {
      title: args.title.trim(),
      description: args.description.trim(),
      updatedAt: Date.now(),
    });
  },
});

export const updateSharing = mutation({
  args: {
    deckId: v.id("decks"),
    visibility: deckVisibilityValidator,
    whitelistEmails: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await assertCanEditDeck(ctx, args.deckId);

    const emails = Array.from(
      new Set(args.whitelistEmails.map((email) => normalizeEmail(email)).filter(Boolean)),
    );

    await ctx.db.patch(args.deckId, {
      visibility: args.visibility,
      whitelistEmails: emails,
      updatedAt: Date.now(),
    });
  },
});

export const getForEdit = query({
  args: {
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    const { deck, user } = await assertCanEditDeck(ctx, args.deckId);
    const sections = await loadDeckTree(ctx, deck._id);

    return {
      deck,
      sections,
      viewer: {
        isOwner: true,
        user,
      },
    };
  },
});

export const getForViewer = query({
  args: {
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    const deck = await getDeckOrThrow(ctx, args.deckId);
    const decision = await getDeckReadDecision(ctx, deck);

    if (!decision.allowed) {
      return {
        access: decision.reason,
        deck: {
          _id: deck._id,
          title: deck.title,
          description: deck.description,
          visibility: deck.visibility,
        },
      };
    }

    const sections = await loadDeckTree(ctx, deck._id);
    return {
      access: "granted",
      deck,
      sections,
      viewer: {
        isOwner: decision.isOwner,
      },
    };
  },
});

export const remove = mutation({
  args: {
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    await assertCanEditDeck(ctx, args.deckId);

    const cards = await ctx.db
      .query("cards")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .collect();

    const sections = await ctx.db
      .query("sections")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .collect();

    const accessRequests = await ctx.db
      .query("deckAccessRequests")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .collect();

    const assets = await ctx.db
      .query("assets")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .collect();

    for (const card of cards) {
      const sides = await ctx.db
        .query("cardSides")
        .withIndex("by_card", (q) => q.eq("cardId", card._id))
        .collect();
      for (const side of sides) {
        await ctx.db.delete(side._id);
      }
      await ctx.db.delete(card._id);
    }

    for (const section of sections) {
      await ctx.db.delete(section._id);
    }

    for (const request of accessRequests) {
      await ctx.db.delete(request._id);
    }

    for (const asset of assets) {
      if (asset.storageId) {
        await ctx.storage.delete(asset.storageId);
      }
      await ctx.db.delete(asset._id);
    }

    await ctx.db.delete(args.deckId);
  },
});

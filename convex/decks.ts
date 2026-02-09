import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import {
  assertCanEditDeck,
  getDeckOrThrow,
  getDeckReadDecision,
} from "./lib/access";
import { ensureCurrentUser, getCurrentUser, normalizeEmail } from "./lib/auth";
import { createDefaultSideIR } from "./lib/sideIR";
import {
  deckDocValidator,
  deckVisibilityValidator,
  getEditShellReturnValidator,
  getForViewerReturnValidator,
} from "./lib/constants";
import {
  parseDeckMetaInput,
  parseDeckSharingInput,
} from "../shared/contracts/deckValidation";

async function loadDeckTree(ctx: QueryCtx, deckId: Id<"decks">) {
  const [sections, cards] = await Promise.all([
    ctx.db
      .query("sections")
      .withIndex("by_deck_order", (q) => q.eq("deckId", deckId))
      .collect(),
    ctx.db
      .query("cards")
      .withIndex("by_deck", (q) => q.eq("deckId", deckId))
      .collect(),
  ]);

  const sidesByCardId = new Map<Id<"cards">, Doc<"cardSides">[]>();
  const cardSides = await Promise.all(
    cards.map((card) =>
      ctx.db
        .query("cardSides")
        .withIndex("by_card_index", (q) => q.eq("cardId", card._id))
        .collect(),
    ),
  );
  cards.forEach((card, index) => {
    sidesByCardId.set(card._id, cardSides[index]);
  });

  const cardsBySection = new Map<Id<"sections">, Array<Doc<"cards"> & { sides: Doc<"cardSides">[] }>>();
  for (const card of cards) {
    const sectionCards = cardsBySection.get(card.sectionId) ?? [];
    sectionCards.push({
      ...card,
      sides: sidesByCardId.get(card._id) ?? [],
    });
    cardsBySection.set(card.sectionId, sectionCards);
  }
  for (const sectionCards of cardsBySection.values()) {
    sectionCards.sort((a, b) => a.order - b.order);
  }

  return sections.map((section) => ({
    ...section,
    cards: cardsBySection.get(section._id) ?? [],
  }));
}

type EditShellCard = Doc<"cards"> & {
  frontSide: Doc<"cardSides"> | null;
};

async function loadDeckEditShell(ctx: QueryCtx, deckId: Id<"decks">) {
  const [sections, cards] = await Promise.all([
    ctx.db
      .query("sections")
      .withIndex("by_deck_order", (q) => q.eq("deckId", deckId))
      .collect(),
    ctx.db
      .query("cards")
      .withIndex("by_deck", (q) => q.eq("deckId", deckId))
      .collect(),
  ]);

  const frontSides = await Promise.all(
    cards.map((card) =>
      ctx.db
        .query("cardSides")
        .withIndex("by_card_index", (q) => q.eq("cardId", card._id).eq("index", 0))
        .first(),
    ),
  );

  const cardsBySection = new Map<Id<"sections">, EditShellCard[]>();
  cards.forEach((card, index) => {
    const sectionCards = cardsBySection.get(card.sectionId) ?? [];
    sectionCards.push({
      ...card,
      frontSide: frontSides[index] ?? null,
    });
    cardsBySection.set(card.sectionId, sectionCards);
  });

  for (const sectionCards of cardsBySection.values()) {
    sectionCards.sort((a, b) => a.order - b.order);
  }

  return sections.map((section) => ({
    ...section,
    cards: cardsBySection.get(section._id) ?? [],
  }));
}

export const listMine = query({
  args: {},
  returns: v.array(deckDocValidator),
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
  returns: v.array(deckDocValidator),
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
  returns: v.object({
    deckId: v.id("decks"),
    sectionId: v.id("sections"),
    cardId: v.id("cards"),
  }),
  handler: async (ctx, args) => {
    const user = await ensureCurrentUser(ctx);
    const now = Date.now();
    const parsedMeta = parseDeckMetaInput({
      title: args.title,
      description: args.description ?? "",
    });

    const deckId = await ctx.db.insert("decks", {
      ownerUserId: user._id,
      title: parsedMeta.title,
      description: parsedMeta.description,
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
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertCanEditDeck(ctx, args.deckId);
    const parsedMeta = parseDeckMetaInput({
      title: args.title,
      description: args.description,
    });
    await ctx.db.patch(args.deckId, {
      title: parsedMeta.title,
      description: parsedMeta.description,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const updateSharing = mutation({
  args: {
    deckId: v.id("decks"),
    visibility: deckVisibilityValidator,
    whitelistEmails: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertCanEditDeck(ctx, args.deckId);
    const parsedSharing = parseDeckSharingInput({
      visibility: args.visibility,
      whitelistEmails: args.whitelistEmails.map((email) => normalizeEmail(email)).filter(Boolean),
    });

    await ctx.db.patch(args.deckId, {
      visibility: parsedSharing.visibility,
      whitelistEmails: parsedSharing.whitelistEmails,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const getEditShell = query({
  args: {
    deckId: v.id("decks"),
  },
  returns: getEditShellReturnValidator,
  handler: async (ctx, args) => {
    const { deck, user } = await assertCanEditDeck(ctx, args.deckId);
    const sections = await loadDeckEditShell(ctx, deck._id);

    return {
      deck,
      sections,
      viewer: {
        isOwner: true as const,
        user,
      },
    };
  },
});

export const getForViewer = query({
  args: {
    deckId: v.id("decks"),
  },
  returns: getForViewerReturnValidator,
  handler: async (ctx, args) => {
    const deck = await getDeckOrThrow(ctx, args.deckId);
    const decision = await getDeckReadDecision(ctx, deck);

    if (!decision.allowed) {
      const deniedAccess =
        decision.reason && decision.reason !== "not_found"
          ? decision.reason
          : "private";
      return {
        access: deniedAccess,
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
      access: "granted" as const,
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
  returns: v.null(),
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
        try {
          await ctx.storage.delete(asset.storageId);
        } catch (error) {
          console.error(`Failed to delete storage for asset ${asset._id}`, error);
        }
      }
      await ctx.db.delete(asset._id);
    }

    await ctx.db.delete(args.deckId);
    return null;
  },
});

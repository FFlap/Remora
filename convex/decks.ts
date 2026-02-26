import { v } from "convex/values";
import { MAX_CARDS_PER_DECK, MAX_SIDES_PER_CARD } from "../shared/contracts/deckConstants";
import { parseDeckMetaInput, parseDeckSharingInput } from "../shared/contracts/deckValidation";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, type QueryCtx, query } from "./_generated/server";
import { assertCanEditDeck, getDeckOrThrow, getDeckReadDecision } from "./lib/access";
import { ensureCurrentUser, getCurrentUser, normalizeEmail } from "./lib/auth";
import {
  deckDocValidator,
  deckVisibilityValidator,
  getEditShellReturnValidator,
  getForViewerReturnValidator,
} from "./lib/constants";
import { createDefaultSideModel } from "./lib/sideModel";

const DECK_CLEANUP_BATCH_SIZE = 20;
const ASSET_RETRY_BASE_DELAY_MS = 30_000;
const ASSET_RETRY_MAX_ATTEMPTS = 8;

async function loadSidesByCardId(
  ctx: QueryCtx,
  deckId: Id<"decks">,
  cards: Doc<"cards">[],
) {
  const sidesByCardId = new Map<Id<"cards">, Doc<"cardSides">[]>();
  const cardIdSet = new Set(cards.map((card) => String(card._id)));
  const maxSides = MAX_CARDS_PER_DECK * MAX_SIDES_PER_CARD;

  const deckSides = await ctx.db
    .query("cardSides")
    .withIndex("by_deck_card_index", (q) => q.eq("deckId", deckId))
    .take(maxSides);

  for (const side of deckSides) {
    if (!cardIdSet.has(String(side.cardId))) continue;
    const sides = sidesByCardId.get(side.cardId) ?? [];
    sides.push(side);
    sidesByCardId.set(side.cardId, sides);
  }

  for (const sides of sidesByCardId.values()) {
    sides.sort((a, b) => a.index - b.index);
  }

  const missingCardIds = cards
    .filter((card) => !sidesByCardId.has(card._id))
    .map((card) => card._id);
  if (missingCardIds.length > 0) {
    const missingSides = await Promise.all(
      missingCardIds.map((cardId) =>
        ctx.db
          .query("cardSides")
          .withIndex("by_card_index", (q) => q.eq("cardId", cardId))
          .take(MAX_SIDES_PER_CARD),
      ),
    );

    missingCardIds.forEach((cardId, index) => {
      sidesByCardId.set(cardId, missingSides[index]);
    });
  }

  return sidesByCardId;
}

async function loadDeckTree(ctx: QueryCtx, deckId: Id<"decks">) {
  const [sections, cards] = await Promise.all([
    ctx.db
      .query("sections")
      .withIndex("by_deck_order", (q) => q.eq("deckId", deckId))
      .collect(),
    ctx.db
      .query("cards")
      .withIndex("by_deck", (q) => q.eq("deckId", deckId))
      .take(MAX_CARDS_PER_DECK),
  ]);

  const sidesByCardId = await loadSidesByCardId(ctx, deckId, cards);

  const cardsBySection = new Map<
    Id<"sections">,
    Array<Doc<"cards"> & { sides: Doc<"cardSides">[] }>
  >();
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
      .take(MAX_CARDS_PER_DECK),
  ]);

  const sidesByCardId = await loadSidesByCardId(ctx, deckId, cards);
  const frontSides = cards.map((card) => {
    const cardSides = sidesByCardId.get(card._id) ?? [];
    return cardSides.find((side) => side.index === 0) ?? cardSides[0] ?? null;
  });

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

    const decks = await ctx.db
      .query("decks")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", user._id))
      .order("desc")
      .collect();
    return decks.filter((deck) => !deck.deletedAt);
  },
});

export const listPublic = query({
  args: {},
  returns: v.array(deckDocValidator),
  handler: async (ctx) => {
    const decks = await ctx.db
      .query("decks")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .order("desc")
      .take(20);
    return decks
      .filter((deck) => !deck.deletedAt)
      .map((deck) => ({
        ...deck,
        whitelistEmails: [],
      }));
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
      deckId,
      cardId,
      index: 0,
      sideModel: createDefaultSideModel("1"),
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("cardSides", {
      deckId,
      cardId,
      index: 1,
      sideModel: createDefaultSideModel("2"),
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
        decision.reason && decision.reason !== "not_found" ? decision.reason : "private";
      return {
        access: deniedAccess,
        deck: {
          _id: deck._id,
          visibility: deck.visibility,
        },
      };
    }

    const sections = await loadDeckTree(ctx, deck._id);
    const sanitizedDeck = decision.isOwner
      ? deck
      : {
          ...deck,
          whitelistEmails: [],
        };
    return {
      access: "granted" as const,
      deck: sanitizedDeck,
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
    // Soft-delete the deck first so it's hidden from queries,
    // then cascade-delete children before hard-deleting the deck.
    await ctx.db.patch(args.deckId, { deletedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.decks.removeCascadeStep, {
      deckId: args.deckId,
      stage: "cards",
    });
    return null;
  },
});

export const removeCascadeStep = internalMutation({
  args: {
    deckId: v.id("decks"),
    stage: v.union(
      v.literal("cards"),
      v.literal("sections"),
      v.literal("accessRequests"),
      v.literal("assets"),
      v.literal("done"),
    ),
  },
  returns: v.null(),
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Cascade delete branches by staged table batches to keep mutation work bounded.
  handler: async (ctx, args) => {
    if (args.stage === "cards") {
      const cards = await ctx.db
        .query("cards")
        .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
        .take(DECK_CLEANUP_BATCH_SIZE);

      if (cards.length === 0) {
        await ctx.scheduler.runAfter(0, internal.decks.removeCascadeStep, {
          deckId: args.deckId,
          stage: "sections",
        });
        return null;
      }

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

      await ctx.scheduler.runAfter(0, internal.decks.removeCascadeStep, {
        deckId: args.deckId,
        stage: "cards",
      });
      return null;
    }

    if (args.stage === "sections") {
      const sections = await ctx.db
        .query("sections")
        .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
        .take(DECK_CLEANUP_BATCH_SIZE);

      if (sections.length === 0) {
        await ctx.scheduler.runAfter(0, internal.decks.removeCascadeStep, {
          deckId: args.deckId,
          stage: "accessRequests",
        });
        return null;
      }

      for (const section of sections) {
        await ctx.db.delete(section._id);
      }

      await ctx.scheduler.runAfter(0, internal.decks.removeCascadeStep, {
        deckId: args.deckId,
        stage: "sections",
      });
      return null;
    }

    if (args.stage === "accessRequests") {
      const accessRequests = await ctx.db
        .query("deckAccessRequests")
        .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
        .take(DECK_CLEANUP_BATCH_SIZE);

      if (accessRequests.length === 0) {
        await ctx.scheduler.runAfter(0, internal.decks.removeCascadeStep, {
          deckId: args.deckId,
          stage: "assets",
        });
        return null;
      }

      for (const request of accessRequests) {
        await ctx.db.delete(request._id);
      }

      await ctx.scheduler.runAfter(0, internal.decks.removeCascadeStep, {
        deckId: args.deckId,
        stage: "accessRequests",
      });
      return null;
    }

    if (args.stage === "done") {
      const deck = await ctx.db.get(args.deckId);
      if (deck) {
        await ctx.db.delete(args.deckId);
      }
      return null;
    }

    const assets = await ctx.db
      .query("assets")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .take(DECK_CLEANUP_BATCH_SIZE);

    if (assets.length === 0) {
      await ctx.scheduler.runAfter(0, internal.decks.removeCascadeStep, {
        deckId: args.deckId,
        stage: "done",
      });
      return null;
    }

    let failedCount = 0;

    for (const asset of assets) {
      if (!asset.storageId) {
        await ctx.db.delete(asset._id);
        continue;
      }

      try {
        await ctx.storage.delete(asset.storageId);
        await ctx.db.delete(asset._id);
      } catch (error) {
        failedCount += 1;
        console.error(`Failed to delete storage for asset ${asset._id}`, error);
        await ctx.db.patch(asset._id, {
          deckId: undefined,
        });
        await ctx.scheduler.runAfter(ASSET_RETRY_BASE_DELAY_MS, internal.decks.retryAssetDelete, {
          assetId: asset._id,
          attempt: 1,
        });
      }
    }

    const delay = failedCount > 0 ? ASSET_RETRY_BASE_DELAY_MS : 0;
    await ctx.scheduler.runAfter(delay, internal.decks.removeCascadeStep, {
      deckId: args.deckId,
      stage: "assets",
    });
    return null;
  },
});

export const retryAssetDelete = internalMutation({
  args: {
    assetId: v.id("assets"),
    attempt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) {
      return null;
    }

    if (!asset.storageId) {
      await ctx.db.delete(asset._id);
      return null;
    }

    try {
      await ctx.storage.delete(asset.storageId);
      await ctx.db.delete(asset._id);
      return null;
    } catch (error) {
      const attempt = Math.max(1, Math.floor(args.attempt ?? 1));
      console.error(
        `Failed to retry storage delete for asset ${asset._id} (attempt ${attempt})`,
        error,
      );
      if (attempt >= ASSET_RETRY_MAX_ATTEMPTS) {
        console.error("Asset storage delete retries exhausted; potential orphaned storage blob", {
          assetId: asset._id,
          storageId: asset.storageId,
          ownerUserId: asset.ownerUserId,
          attempt,
          maxAttempts: ASSET_RETRY_MAX_ATTEMPTS,
        });
        await ctx.db.delete(asset._id);
        return null;
      }

      await ctx.scheduler.runAfter(
        ASSET_RETRY_BASE_DELAY_MS * Math.min(8, attempt + 1),
        internal.decks.retryAssetDelete,
        {
          assetId: asset._id,
          attempt: attempt + 1,
        },
      );
      return null;
    }
  },
});

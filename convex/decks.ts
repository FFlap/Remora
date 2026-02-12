import { v } from "convex/values";
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
    const decks = await ctx.db
      .query("decks")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .order("desc")
      .take(20);
    return decks.map((deck) => ({
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
          title: deck.title,
          description: deck.description,
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
    await ctx.scheduler.runAfter(0, internal.decks.removeCascadeStep, {
      deckId: args.deckId,
      stage: "cards",
    });
    await ctx.db.delete(args.deckId);
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

    const assets = await ctx.db
      .query("assets")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .take(DECK_CLEANUP_BATCH_SIZE);

    if (assets.length === 0) {
      return null;
    }

    let deletedCount = 0;
    let failedCount = 0;

    for (const asset of assets) {
      if (!asset.storageId) {
        await ctx.db.delete(asset._id);
        deletedCount += 1;
        continue;
      }

      try {
        await ctx.storage.delete(asset.storageId);
        await ctx.db.delete(asset._id);
        deletedCount += 1;
      } catch (error) {
        failedCount += 1;
        console.error(`Failed to delete storage for asset ${asset._id}`, error);
        await ctx.scheduler.runAfter(ASSET_RETRY_BASE_DELAY_MS, internal.decks.retryAssetDelete, {
          assetId: asset._id,
          attempt: 1,
        });
      }
    }

    let delay = 0;
    if (deletedCount === 0 && failedCount > 0) {
      delay = ASSET_RETRY_BASE_DELAY_MS;
    }
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
      console.error(`Failed to retry storage delete for asset ${asset._id}`, error);
      if (attempt >= ASSET_RETRY_MAX_ATTEMPTS) {
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

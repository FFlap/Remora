import { v } from "convex/values";
import { MAX_WHITELIST_EMAILS } from "../shared/contracts/deckConstants";
import { parseAccessRequestMessage } from "../shared/contracts/deckValidation";
import { mutation, query } from "./_generated/server";
import { assertCanEditDeck, getDeckOrThrow } from "./lib/access";
import { ensureCurrentUser, getCurrentUser, normalizeEmail } from "./lib/auth";
import { deckAccessRequestDocValidator } from "./lib/constants";

const RE_REQUEST_COOLDOWN_MS = 1000 * 60 * 60 * 24; // 24 hours

export const requestAccess = mutation({
  args: {
    deckId: v.id("decks"),
    message: v.optional(v.string()),
  },
  returns: v.id("deckAccessRequests"),
  handler: async (ctx, args) => {
    const user = await ensureCurrentUser(ctx);
    const deck = await getDeckOrThrow(ctx, args.deckId);
    const message = parseAccessRequestMessage(args.message);

    if (deck.visibility !== "whitelist") {
      throw new Error("This deck does not accept access requests");
    }

    if (deck.ownerUserId === user._id) {
      throw new Error("Owners do not need access requests");
    }

    const requesterEmail = normalizeEmail(user.email);
    if (
      requesterEmail &&
      deck.whitelistEmails.map(normalizeEmail).filter(Boolean).includes(requesterEmail)
    ) {
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
      if (existing.status === "pending" || existing.status === "approved") {
        return existing._id;
      }

      if (
        existing.status === "rejected" &&
        now - existing.updatedAt < RE_REQUEST_COOLDOWN_MS
      ) {
        throw new Error("Please wait before requesting access again");
      }

      await ctx.db.patch(existing._id, {
        status: "pending",
        message,
        updatedAt: now,
        resolvedByUserId: undefined,
      });
      return existing._id;
    }

    return await ctx.db.insert("deckAccessRequests", {
      deckId: deck._id,
      requesterUserId: user._id,
      requesterEmail,
      message,
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
  returns: v.union(deckAccessRequestDocValidator, v.null()),
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
  returns: v.array(deckAccessRequestDocValidator),
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
  returns: v.null(),
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
      const normalizedRequesterEmail = normalizeEmail(request.requesterEmail);
      if (normalizedRequesterEmail) {
        const alreadyWhitelisted = deck.whitelistEmails.includes(normalizedRequesterEmail);
        if (!alreadyWhitelisted && deck.whitelistEmails.length >= MAX_WHITELIST_EMAILS) {
          throw new Error(`Whitelist cannot exceed ${MAX_WHITELIST_EMAILS} entries`);
        }
        if (!alreadyWhitelisted) {
          const whitelistEmails = [...deck.whitelistEmails, normalizedRequesterEmail].filter(Boolean);
          await ctx.db.patch(deck._id, {
            whitelistEmails,
            updatedAt: now,
          });
        }
      }
    }
    return null;
  },
});

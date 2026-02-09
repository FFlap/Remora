import type { Id, Doc } from "../_generated/dataModel";
import type { ReadCtx, WriteCtx } from "./auth";
import { getCurrentUser, normalizeEmail } from "./auth";

type AnyCtx = ReadCtx | WriteCtx;

export type DeckReadDecision = {
  allowed: boolean;
  isOwner: boolean;
  reason?:
    | "not_found"
    | "private"
    | "whitelist_sign_in_required"
    | "whitelist_pending"
    | "whitelist_requestable";
};

export async function getDeckOrThrow(ctx: AnyCtx, deckId: Id<"decks">) {
  const deck = await ctx.db.get(deckId);
  if (!deck) {
    throw new Error("Deck not found");
  }
  return deck;
}

export async function getDeckReadDecision(
  ctx: AnyCtx,
  deck: Doc<"decks">,
): Promise<DeckReadDecision> {
  const identity = await ctx.auth.getUserIdentity();
  const user = await getCurrentUser(ctx);

  if (user && deck.ownerUserId === user._id) {
    return { allowed: true, isOwner: true };
  }

  if (deck.visibility === "public" || deck.visibility === "unlisted") {
    return { allowed: true, isOwner: false };
  }

  if (deck.visibility === "private") {
    return { allowed: false, isOwner: false, reason: "private" };
  }

  if (!identity) {
    return {
      allowed: false,
      isOwner: false,
      reason: "whitelist_sign_in_required",
    };
  }

  const normalizedViewerEmail = normalizeEmail(identity.email);
  const normalizedWhitelist = deck.whitelistEmails.map(normalizeEmail);

  if (normalizedWhitelist.includes(normalizedViewerEmail)) {
    return { allowed: true, isOwner: false };
  }

  if (user) {
    const existingRequest = await ctx.db
      .query("deckAccessRequests")
      .withIndex("by_requester_and_deck", (q) =>
        q.eq("requesterUserId", user._id).eq("deckId", deck._id),
      )
      .first();

    if (existingRequest?.status === "pending") {
      return {
        allowed: false,
        isOwner: false,
        reason: "whitelist_pending",
      };
    }
  }

  return {
    allowed: false,
    isOwner: false,
    reason: "whitelist_requestable",
  };
}

export async function assertCanReadDeck(ctx: AnyCtx, deckId: Id<"decks">) {
  const deck = await getDeckOrThrow(ctx, deckId);
  const decision = await getDeckReadDecision(ctx, deck);
  if (!decision.allowed) {
    throw new Error("Forbidden");
  }
  return { deck, decision };
}

export async function assertCanEditDeck(ctx: AnyCtx, deckId: Id<"decks">) {
  const deck = await getDeckOrThrow(ctx, deckId);
  const user = await getCurrentUser(ctx);
  if (!user || deck.ownerUserId !== user._id) {
    throw new Error("Forbidden");
  }
  return { deck, user };
}

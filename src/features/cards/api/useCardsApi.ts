import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/convexApi";

export function useCards(deckId: string | Id<"decks"> | undefined) {
  const typedDeckId = deckId as Id<"decks"> | undefined;
  return useQuery(api.cards.listByDeck, typedDeckId ? { deckId: typedDeckId } : "skip");
}

export function useCreateCard() {
  return useMutation(api.cards.create);
}

export function useReorderCardsInSection() {
  return useMutation(api.cards.reorderInSection);
}

export function useMoveCardToSection() {
  return useMutation(api.cards.moveToSection);
}

export function useRemoveCard() {
  return useMutation(api.cards.remove);
}

export function useCardSides(cardId: string | Id<"cards"> | undefined) {
  const typedCardId = cardId as Id<"cards"> | undefined;
  return useQuery(api.cardSides.listByCard, typedCardId ? { cardId: typedCardId } : "skip");
}

export function useSaveSide() {
  return useMutation(api.cardSides.saveSide);
}

export function useAddSide() {
  return useMutation(api.cardSides.addSide);
}

export function useDeleteSide() {
  return useMutation(api.cardSides.deleteSide);
}

import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convexApi";

export function useCards(deckId: string | undefined) {
  return useQuery(api.cards.listByDeck, deckId ? ({ deckId } as any) : "skip");
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

export function useCardSides(cardId: string | undefined) {
  return useQuery(api.cardSides.listByCard, cardId ? ({ cardId } as any) : "skip");
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

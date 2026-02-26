import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/convexApi";

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

export function useSaveSide() {
  return useMutation(api.cardSides.saveSide);
}

export function useEditorCard(cardId: string | Id<"cards"> | undefined) {
  const typedCardId = cardId as Id<"cards"> | undefined;
  return useQuery(api.cards.getEditorCard, typedCardId ? { cardId: typedCardId } : "skip");
}

export function useAddSide() {
  return useMutation(api.cardSides.addSide);
}

export function useDeleteSide() {
  return useMutation(api.cardSides.deleteSide);
}

export function useReorderSides() {
  return useMutation(api.cardSides.reorder);
}

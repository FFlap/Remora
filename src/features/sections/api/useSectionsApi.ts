import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/convexApi";

export function useSections(deckId: string | Id<"decks"> | undefined) {
  const typedDeckId = deckId as Id<"decks"> | undefined;
  return useQuery(api.sections.listByDeck, typedDeckId ? { deckId: typedDeckId } : "skip");
}

export function useCreateSection() {
  return useMutation(api.sections.create);
}

export function useRenameSection() {
  return useMutation(api.sections.rename);
}

export function useReorderSections() {
  return useMutation(api.sections.reorder);
}

export function useRemoveSection() {
  return useMutation(api.sections.remove);
}

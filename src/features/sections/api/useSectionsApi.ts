import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convexApi";

export function useSections(deckId: string | undefined) {
  return useQuery(api.sections.listByDeck, deckId ? ({ deckId } as any) : "skip");
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

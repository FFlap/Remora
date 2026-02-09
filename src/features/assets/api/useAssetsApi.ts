import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/convexApi";

export function useDeckAssets(deckId: string | Id<"decks"> | undefined) {
  const typedDeckId = deckId as Id<"decks"> | undefined;
  return useQuery(api.assets.listByDeck, typedDeckId ? { deckId: typedDeckId } : "skip");
}

export function useGenerateUploadUrl() {
  return useMutation(api.assets.generateUploadUrl);
}

export function useSaveUploadedImage() {
  return useMutation(api.assets.saveUploadedImage);
}

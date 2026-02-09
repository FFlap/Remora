import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convexApi";

export function useDeckAssets(deckId: string | undefined) {
  return useQuery(api.assets.listByDeck, deckId ? ({ deckId } as any) : "skip");
}

export function useGenerateUploadUrl() {
  return useMutation(api.assets.generateUploadUrl);
}

export function useSaveUploadedImage() {
  return useMutation(api.assets.saveUploadedImage);
}

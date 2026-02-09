import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convexApi";

export function useMyDecks() {
  return useQuery(api.decks.listMine, {});
}

export function usePublicDecks() {
  return useQuery(api.decks.listPublic, {});
}

export function useDeckForEdit(deckId: string | undefined) {
  return useQuery(api.decks.getForEdit, deckId ? ({ deckId } as any) : "skip");
}

export function useDeckForViewer(deckId: string | undefined) {
  return useQuery(api.decks.getForViewer, deckId ? ({ deckId } as any) : "skip");
}

export function useCreateDeck() {
  return useMutation(api.decks.create);
}

export function useUpdateDeckMeta() {
  return useMutation(api.decks.updateMeta);
}

export function useUpdateDeckSharing() {
  return useMutation(api.decks.updateSharing);
}

export function useDeleteDeck() {
  return useMutation(api.decks.remove);
}

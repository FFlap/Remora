import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/convexApi";

function asDeckId(deckId: string | Id<"decks"> | undefined) {
  return deckId as Id<"decks"> | undefined;
}

export function useMyDecks() {
  return useQuery(api.decks.listMine, {});
}

export function usePublicDecks() {
  return useQuery(api.decks.listPublic, {});
}

export function useDeckEditShell(deckId: string | Id<"decks"> | undefined) {
  const typedDeckId = asDeckId(deckId);
  return useQuery(api.decks.getEditShell, typedDeckId ? { deckId: typedDeckId } : "skip");
}

export function useDeckForViewer(deckId: string | Id<"decks"> | undefined) {
  const typedDeckId = asDeckId(deckId);
  return useQuery(api.decks.getForViewer, typedDeckId ? { deckId: typedDeckId } : "skip");
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

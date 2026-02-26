import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/convexApi";

function asDeckId(deckId: string | Id<"decks"> | undefined) {
  return deckId as Id<"decks"> | undefined;
}

export function useMyRequestStatus(deckId: string | Id<"decks"> | undefined) {
  const typedDeckId = asDeckId(deckId);
  return useQuery(
    api.accessRequests.myRequestStatus,
    typedDeckId ? { deckId: typedDeckId } : "skip",
  );
}

export function useRequestAccess() {
  return useMutation(api.accessRequests.requestAccess);
}

export function useDeckAccessRequests(deckId: string | Id<"decks"> | undefined) {
  const typedDeckId = asDeckId(deckId);
  return useQuery(
    api.accessRequests.listForDeckOwner,
    typedDeckId ? { deckId: typedDeckId } : "skip",
  );
}

export function useResolveAccessRequest() {
  return useMutation(api.accessRequests.resolveRequest);
}

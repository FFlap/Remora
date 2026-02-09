import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convexApi";

export function useMyRequestStatus(deckId: string | undefined) {
  return useQuery(
    api.accessRequests.myRequestStatus,
    deckId ? ({ deckId } as any) : "skip",
  );
}

export function useRequestAccess() {
  return useMutation(api.accessRequests.requestAccess);
}

export function useDeckAccessRequests(deckId: string | undefined) {
  return useQuery(
    api.accessRequests.listForDeckOwner,
    deckId ? ({ deckId } as any) : "skip",
  );
}

export function useResolveAccessRequest() {
  return useMutation(api.accessRequests.resolveRequest);
}

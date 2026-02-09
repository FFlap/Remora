import { useMutation } from "convex/react";
import { api } from "@/lib/convexApi";

export function useUpdateSharing() {
  return useMutation(api.decks.updateSharing);
}

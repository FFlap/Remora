import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/lib/convexApi";

type RequestAccessMutation = (args: { deckId: Id<"decks">; message?: string }) => Promise<unknown>;

export function useDeckViewerAccessRequest(deckId: string, requestAccess: RequestAccessMutation) {
  const typedDeckId = deckId as Id<"decks">;
  const [requestMessage, setRequestMessage] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestingAccess, setRequestingAccess] = useState(false);

  const submitRequest = async () => {
    setRequestingAccess(true);
    setRequestError(null);

    try {
      await requestAccess({
        deckId: typedDeckId,
        message: requestMessage,
      });
      toast.success("Access requested");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to request access";
      setRequestError(message);
      toast.error(message);
    } finally {
      setRequestingAccess(false);
    }
  };

  return {
    requestMessage,
    setRequestMessage,
    requestError,
    requestingAccess,
    submitRequest,
  };
}

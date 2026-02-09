import { useCallback, useEffect, useMemo, useState } from "react";
import { ZodError } from "zod";
import { toast } from "sonner";
import { parseDeckSharingInput } from "../../../shared/contracts/deckValidation";
import type { Doc } from "@/lib/convexApi";

export type ShareDeckVisibility = "public" | "unlisted" | "private" | "whitelist";

type DeckDoc = Doc<"decks">;

function parseEmails(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[\n,]/)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function useShareDeckDialogState({
  deck,
  onSave,
  open,
  onOpenChange,
}: {
  deck: DeckDoc;
  onSave: (payload: {
    deckId: string;
    visibility: ShareDeckVisibility;
    whitelistEmails: string[];
  }) => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [visibility, setVisibility] = useState(deck.visibility);
  const [emailsRaw, setEmailsRaw] = useState(deck.whitelistEmails.join("\n"));
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;
  const parsedEmails = useMemo(() => parseEmails(emailsRaw), [emailsRaw]);
  const shareUrl =
    typeof window === "undefined"
      ? `/deck/${deck._id}`
      : `${window.location.origin}/deck/${deck._id}`;

  useEffect(() => {
    if (!isOpen) return;
    setVisibility(deck.visibility);
    setEmailsRaw(deck.whitelistEmails.join("\n"));
    setLocalError(null);
  }, [deck.visibility, deck.whitelistEmails, isOpen]);

  const saveChanges = useCallback(async () => {
    setSaving(true);
    setLocalError(null);

    try {
      const parsed = parseDeckSharingInput({
        visibility,
        whitelistEmails: parsedEmails,
      });
      await onSave({
        deckId: String(deck._id),
        visibility: parsed.visibility,
        whitelistEmails: parsed.whitelistEmails,
      });
      setIsOpen(false);
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.issues[0]?.message ?? "Invalid sharing settings";
        setLocalError(message);
        toast.error(message);
      } else {
        const message = error instanceof Error ? error.message : "Failed to save sharing settings";
        setLocalError(message);
        toast.error(message);
      }
    } finally {
      setSaving(false);
    }
  }, [deck._id, onSave, parsedEmails, setIsOpen, visibility]);

  return {
    isOpen,
    setIsOpen,
    visibility,
    setVisibility,
    emailsRaw,
    setEmailsRaw,
    parsedEmails,
    shareUrl,
    saving,
    localError,
    saveChanges,
  };
}

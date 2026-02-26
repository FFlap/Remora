import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { useUpdateDeckMeta, useUpdateDeckSharing } from "@/features/decks/api/useDecksApi";
import type { Doc } from "@/lib/convexApi";
import { getValidationMessage } from "@/lib/validationErrors";
import {
  parseDeckMetaInput,
  parseDeckSharingInput,
} from "../../../../shared/contracts/deckValidation";

export type DeckListItem = Doc<"decks">;
export type DeckVisibility = "public" | "unlisted" | "private" | "whitelist";
export type DeckSettingsFocusField = "title" | "description" | "visibility";

function useDeckSettingsFocus({
  isSettingsOpen,
  focusField,
  titleRef,
  descriptionRef,
  visibilityRef,
}: {
  isSettingsOpen: boolean;
  focusField: DeckSettingsFocusField | null;
  titleRef: RefObject<HTMLInputElement | null>;
  descriptionRef: RefObject<HTMLTextAreaElement | null>;
  visibilityRef: RefObject<HTMLSelectElement | null>;
}) {
  useEffect(() => {
    if (!isSettingsOpen || !focusField) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      if (focusField === "title") {
        titleRef.current?.focus();
        titleRef.current?.select();
      } else if (focusField === "description") {
        descriptionRef.current?.focus();
      } else {
        visibilityRef.current?.focus();
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [descriptionRef, focusField, isSettingsOpen, titleRef, visibilityRef]);
}

export function useDeckSettingsDialog({
  updateDeckMeta,
  updateDeckSharing,
}: {
  updateDeckMeta: ReturnType<typeof useUpdateDeckMeta>;
  updateDeckSharing: ReturnType<typeof useUpdateDeckSharing>;
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deckInSettings, setDeckInSettings] = useState<DeckListItem | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<DeckVisibility>("private");
  const [savingSettings, setSavingSettings] = useState(false);
  const [focusField, setFocusField] = useState<DeckSettingsFocusField | null>(null);

  const titleRef = useRef<HTMLInputElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const visibilityRef = useRef<HTMLSelectElement | null>(null);

  useDeckSettingsFocus({
    isSettingsOpen,
    focusField,
    titleRef,
    descriptionRef,
    visibilityRef,
  });

  const resetDialog = useCallback(() => {
    setIsSettingsOpen(false);
    setDeckInSettings(null);
    setFocusField(null);
  }, []);

  const openSettings = useCallback((deck: DeckListItem, initialFocus: DeckSettingsFocusField) => {
    setDeckInSettings(deck);
    setTitle(deck.title ?? "");
    setDescription(deck.description ?? "");
    setVisibility((deck.visibility ?? "private") as DeckVisibility);
    setFocusField(initialFocus);
    setIsSettingsOpen(true);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsSettingsOpen(open);
    if (!open) {
      setFocusField(null);
    }
  }, []);

  const saveSettings = useCallback(async () => {
    if (!deckInSettings) {
      return;
    }

    setSavingSettings(true);
    try {
      const parsedMeta = parseDeckMetaInput({
        title,
        description,
      });
      const parsedSharing = parseDeckSharingInput({
        visibility,
        whitelistEmails: deckInSettings.whitelistEmails ?? [],
      });

      await updateDeckMeta({
        deckId: deckInSettings._id,
        title: parsedMeta.title,
        description: parsedMeta.description,
      });
      await updateDeckSharing({
        deckId: deckInSettings._id,
        visibility: parsedSharing.visibility,
        whitelistEmails: parsedSharing.whitelistEmails,
      });

      toast.success("Deck settings saved");
      resetDialog();
    } catch (error) {
      toast.error(getValidationMessage(error, "Failed to save deck settings"));
    } finally {
      setSavingSettings(false);
    }
  }, [
    deckInSettings,
    description,
    resetDialog,
    title,
    updateDeckMeta,
    updateDeckSharing,
    visibility,
  ]);

  return {
    isSettingsOpen,
    deckInSettings,
    title,
    description,
    visibility,
    savingSettings,
    titleRef,
    descriptionRef,
    visibilityRef,
    setTitle,
    setDescription,
    setVisibility,
    openSettings,
    handleOpenChange,
    saveSettings,
    resetDialog,
  };
}

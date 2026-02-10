import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { NavigateFn } from "@tanstack/react-router";
import type { DeckEditShellData, DeckEditorCardData } from "@/features/decks/types/editor";

export function useDeckEditorSelection({
  data,
  deckId,
  preselectedCardId,
  navigate,
  selectedCardId,
  setSelectedCardId,
  selectedCardData,
}: {
  data: DeckEditShellData | undefined;
  deckId: string;
  preselectedCardId?: string;
  navigate: NavigateFn;
  selectedCardId: string | undefined;
  setSelectedCardId: Dispatch<SetStateAction<string | undefined>>;
  selectedCardData: DeckEditorCardData | undefined;
}) {
  const [activeSideIndex, setActiveSideIndex] = useState(0);
  const [editorMode, setEditorMode] = useState<"quick" | "creative">("quick");
  const lastModeSyncedCardIdRef = useRef<string | null>(null);

  const selectedCardInShell = useMemo(() => {
    if (!data || !selectedCardId) return null;
    for (const section of data.sections) {
      const match = section.cards.find((card) => String(card._id) === selectedCardId);
      if (match) return match;
    }
    return null;
  }, [data, selectedCardId]);

  const selectedCardFromQuery = useMemo(() => {
    if (!selectedCardData || !selectedCardId) return null;
    return String(selectedCardData.card._id) === selectedCardId ? selectedCardData.card : null;
  }, [selectedCardData, selectedCardId]);

  const selectedCard = selectedCardFromQuery ?? selectedCardInShell;

  const currentSideDoc = useMemo(() => {
    if (!selectedCardFromQuery || !selectedCardData) return null;
    const sortedSides = [...selectedCardData.sides].sort((a, b) => a.index - b.index);
    return sortedSides.find((side) => side.index === activeSideIndex) ?? null;
  }, [selectedCardFromQuery, selectedCardData, activeSideIndex]);

  useEffect(() => {
    if (!data) return;
    const allCardIds = data.sections.flatMap((section) =>
      section.cards.map((card) => String(card._id)),
    );

    if (!selectedCardId) {
      const fallbackId = allCardIds[0];
      if (!fallbackId) return;
      setSelectedCardId(fallbackId);
      void navigate({
        to: "/app/decks/$deckId/edit/card/$cardId",
        params: { deckId, cardId: fallbackId },
        replace: true,
      });
      return;
    }

    if (allCardIds.includes(selectedCardId)) {
      return;
    }

    if (selectedCardData === undefined) {
      // Wait for card query to hydrate after create/move mutations.
      return;
    }

    const selectedCardResolvedFromQuery =
      selectedCardData && String(selectedCardData.card._id) === selectedCardId;
    if (selectedCardResolvedFromQuery) {
      return;
    }

    const fallbackId = allCardIds[0];
    if (!fallbackId) return;
    setSelectedCardId(fallbackId);
    void navigate({
      to: "/app/decks/$deckId/edit/card/$cardId",
      params: { deckId, cardId: fallbackId },
      replace: true,
    });
  }, [data, selectedCardId, deckId, navigate, setSelectedCardId, selectedCardData]);

  useEffect(() => {
    if (!preselectedCardId) return;
    setSelectedCardId(preselectedCardId);
  }, [preselectedCardId, setSelectedCardId]);

  useEffect(() => {
    if (!selectedCard) return;
    const currentCardId = String(selectedCard._id);
    if (lastModeSyncedCardIdRef.current === currentCardId) return;
    lastModeSyncedCardIdRef.current = currentCardId;
    setEditorMode(selectedCard.lastEditedMode === "creative" ? "creative" : "quick");
  }, [selectedCard]);

  return {
    activeSideIndex,
    setActiveSideIndex,
    editorMode,
    setEditorMode,
    selectedCard,
    currentSideDoc,
  };
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { asSideIR } from "@/features/cards/side-ir/types";
import type { OrderedViewerCard, ViewerSection, ViewerSide } from "./viewerTypes";

function flattenSections(sections: ViewerSection[]): OrderedViewerCard[] {
  const flattened: OrderedViewerCard[] = [];

  sections.forEach((section) => {
    section.cards.forEach((card, sectionCardIndex) => {
      flattened.push({
        cardId: String(card._id),
        sectionId: String(section._id),
        sectionTitle: section.title,
        card,
        sectionCardIndex,
      });
    });
  });

  return flattened;
}

function nextSideIndex(currentSideIndex: number, sortedSides: ViewerSide[]): number {
  if (sortedSides.length === 0) {
    return currentSideIndex;
  }

  if (sortedSides.length === 2) {
    const firstIndex = sortedSides[0].index;
    const secondIndex = sortedSides[1].index;
    return currentSideIndex === secondIndex ? firstIndex : secondIndex;
  }

  const currentPosition = sortedSides.findIndex((entry) => entry.index === currentSideIndex);
  const nextPosition = (currentPosition + 1) % sortedSides.length;
  return sortedSides[nextPosition].index;
}

type UseDeckViewerStateArgs = {
  preselectedCardId?: string;
  sections: ViewerSection[];
  onNavigateToCard: (cardId: string, replace?: boolean) => void;
};

export function useDeckViewerState({
  preselectedCardId,
  sections,
  onNavigateToCard,
}: UseDeckViewerStateArgs) {
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(preselectedCardId);
  const [sideIndex, setSideIndex] = useState(0);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const orderedCards = useMemo(() => flattenSections(sections), [sections]);
  const selectedCardEntry = useMemo(() => {
    if (orderedCards.length === 0) {
      return null;
    }

    return orderedCards.find((entry) => entry.cardId === selectedCardId) ?? orderedCards[0];
  }, [orderedCards, selectedCardId]);
  const selectedCard = selectedCardEntry?.card ?? null;

  useEffect(() => {
    setSelectedCardId(preselectedCardId);
  }, [preselectedCardId]);

  useEffect(() => {
    if (orderedCards.length === 0) {
      return;
    }

    const hasSelected = Boolean(
      selectedCardId && orderedCards.some((entry) => entry.cardId === selectedCardId),
    );
    if (hasSelected) {
      return;
    }

    const fallbackId = orderedCards[0].cardId;
    setSelectedCardId(fallbackId);
    onNavigateToCard(fallbackId, true);
  }, [orderedCards, selectedCardId, onNavigateToCard]);

  useEffect(() => {
    const sectionIds = new Set(sections.map((section) => String(section._id)));
    setCollapsedSections((current) => {
      const next: Record<string, boolean> = {};
      Object.keys(current).forEach((sectionId) => {
        if (sectionIds.has(sectionId)) {
          next[sectionId] = current[sectionId];
        }
      });
      return next;
    });
  }, [sections]);

  useEffect(() => {
    if (selectedCardId) {
      setSideIndex(0);
    }
  }, [selectedCardId]);

  const sortedSides = useMemo(
    () => [...(selectedCard?.sides ?? [])].sort((a, b) => a.index - b.index),
    [selectedCard],
  );
  const sideCount = sortedSides.length;
  const selectedSide = sortedSides.find((entry) => entry.index === sideIndex) ?? sortedSides[0];
  const selectedSideIR = asSideIR(selectedSide?.sideIR);
  const activeSidePosition = Math.max(
    0,
    sortedSides.findIndex((entry) => entry.index === selectedSide?.index),
  );

  const orderedCardIndex = selectedCardEntry
    ? orderedCards.findIndex((entry) => entry.cardId === selectedCardEntry.cardId)
    : -1;
  const prevCard = orderedCardIndex > 0 ? orderedCards[orderedCardIndex - 1] : null;
  const nextCard =
    orderedCardIndex >= 0 && orderedCardIndex < orderedCards.length - 1
      ? orderedCards[orderedCardIndex + 1]
      : null;

  const goToCard = useCallback(
    (cardId: string) => {
      setSelectedCardId(cardId);
      onNavigateToCard(cardId);
    },
    [onNavigateToCard],
  );

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((current) => ({
      ...current,
      [sectionId]: !(current[sectionId] ?? false),
    }));
  }, []);

  const advanceSide = useCallback(() => {
    setSideIndex((currentSideIndex) => nextSideIndex(currentSideIndex, sortedSides));
  }, [sortedSides]);

  return {
    selectedCardId,
    selectedCardEntry,
    selectedCard,
    orderedCards,
    collapsedSections,
    sortedSides,
    sideIndex,
    sideCount,
    selectedSide,
    selectedSideIR,
    activeSidePosition,
    orderedCardIndex,
    prevCard,
    nextCard,
    setSideIndex,
    goToCard,
    toggleSection,
    advanceSide,
  };
}

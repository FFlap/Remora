import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useCallback } from "react";
import type { useReorderCardsInSection } from "@/features/cards/api/useCardsApi";
import type { useReorderSections } from "@/features/sections/api/useSectionsApi";
import type { Id } from "@/lib/convexApi";

export function useDeckSidebarReorderActions({
  deckId,
  sectionIds,
  reorderSections,
  reorderCards,
}: {
  deckId: string;
  sectionIds: Id<"sections">[];
  reorderSections: ReturnType<typeof useReorderSections>;
  reorderCards: ReturnType<typeof useReorderCardsInSection>;
}) {
  const onSectionDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;

      const oldIndex = sectionIds.indexOf(active.id as Id<"sections">);
      const newIndex = sectionIds.indexOf(over.id as Id<"sections">);
      if (oldIndex < 0 || newIndex < 0) return;

      const ordered = arrayMove(sectionIds, oldIndex, newIndex);
      await reorderSections({
        deckId: deckId as Id<"decks">,
        orderedSectionIds: ordered,
      });
    },
    [deckId, reorderSections, sectionIds],
  );

  const onCardDragEnd = useCallback(
    async (sectionId: Id<"sections">, cardIds: Id<"cards">[], { active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;

      const oldIndex = cardIds.indexOf(active.id as Id<"cards">);
      const newIndex = cardIds.indexOf(over.id as Id<"cards">);
      if (oldIndex < 0 || newIndex < 0) return;

      const ordered = arrayMove(cardIds, oldIndex, newIndex);
      await reorderCards({
        sectionId,
        orderedCardIds: ordered,
      });
    },
    [reorderCards],
  );

  return {
    onSectionDragEnd,
    onCardDragEnd,
  };
}

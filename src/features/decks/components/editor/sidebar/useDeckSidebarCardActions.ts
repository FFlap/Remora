import { useCallback } from "react";
import { toast } from "sonner";
import type {
  useCreateCard,
  useMoveCardToSection,
  useRemoveCard,
  useReorderCardsInSection,
} from "@/features/cards/api/useCardsApi";
import type { DeckEditShellData } from "@/features/decks/types/editor";
import type { Id } from "@/lib/convexApi";

export function useDeckSidebarCardActions({
  deckId,
  data,
  selectedCardId,
  createCard,
  reorderCards,
  moveCardToSection,
  removeCard,
  selectCard,
  clearSelection,
  closeContextMenu,
}: {
  deckId: string;
  data: DeckEditShellData;
  selectedCardId?: string;
  createCard: ReturnType<typeof useCreateCard>;
  reorderCards: ReturnType<typeof useReorderCardsInSection>;
  moveCardToSection: ReturnType<typeof useMoveCardToSection>;
  removeCard: ReturnType<typeof useRemoveCard>;
  selectCard: (cardId: string) => void;
  clearSelection: () => void;
  closeContextMenu: () => void;
}) {
  const handleNewCardInSection = useCallback(
    async (sectionId: string, insertIndex: number) => {
      closeContextMenu();
      try {
        const newCardId = await createCard({
          deckId: deckId as Id<"decks">,
          sectionId: sectionId as Id<"sections">,
        });
        const section = data.sections.find((entry) => String(entry._id) === sectionId);
        if (section) {
          const existingIds = section.cards.map((card) => card._id);
          const bounded = Math.max(0, Math.min(insertIndex, existingIds.length));
          if (bounded < existingIds.length) {
            const orderedCardIds = [...existingIds];
            orderedCardIds.splice(bounded, 0, newCardId);
            await reorderCards({
              sectionId: sectionId as Id<"sections">,
              orderedCardIds,
            });
          }
        }

        selectCard(String(newCardId));
        toast.success("Card created");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create card");
      }
    },
    [closeContextMenu, createCard, data.sections, deckId, reorderCards, selectCard],
  );

  const handleMoveCardToSection = useCallback(
    async (cardId: string, sectionId: string) => {
      closeContextMenu();
      try {
        await moveCardToSection({
          cardId: cardId as Id<"cards">,
          sectionId: sectionId as Id<"sections">,
        });
        toast.success("Card moved");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to move card");
      }
    },
    [closeContextMenu, moveCardToSection],
  );

  const handleDeleteCard = useCallback(
    async (cardId: string) => {
      closeContextMenu();
      try {
        const wasSelected = selectedCardId === cardId;
        await removeCard({ cardId: cardId as Id<"cards"> });
        toast.success("Card deleted");
        if (wasSelected) {
          clearSelection();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete card");
      }
    },
    [clearSelection, closeContextMenu, removeCard, selectedCardId],
  );

  return {
    handleNewCardInSection,
    handleMoveCardToSection,
    handleDeleteCard,
  };
}

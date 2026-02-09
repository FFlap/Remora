import { useCallback } from "react";
import { toast } from "sonner";
import type { useCreateCard } from "@/features/cards/api/useCardsApi";
import type { DeckEditShellData } from "@/features/decks/types/editor";
import type {
  useCreateSection,
  useRemoveSection,
  useRenameSection,
} from "@/features/sections/api/useSectionsApi";
import type { Id } from "@/lib/convexApi";

export function useDeckSidebarSectionActions({
  deckId,
  data,
  selectedCardId,
  createSection,
  createCard,
  renameSection,
  removeSection,
  selectCard,
  clearSelection,
  closeContextMenu,
}: {
  deckId: string;
  data: DeckEditShellData;
  selectedCardId?: string;
  createSection: ReturnType<typeof useCreateSection>;
  createCard: ReturnType<typeof useCreateCard>;
  renameSection: ReturnType<typeof useRenameSection>;
  removeSection: ReturnType<typeof useRemoveSection>;
  selectCard: (cardId: string) => void;
  clearSelection: () => void;
  closeContextMenu: () => void;
}) {
  const createSectionWithCard = useCallback(async () => {
    try {
      const sectionId = await createSection({
        deckId: deckId as Id<"decks">,
        title: `Section ${data.sections.length + 1}`,
      });
      const cardId = await createCard({
        deckId: deckId as Id<"decks">,
        sectionId,
      });
      selectCard(String(cardId));
      toast.success("Section created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create section");
    }
  }, [createCard, createSection, data.sections.length, deckId, selectCard]);

  const handleRenameSection = useCallback(
    async (sectionId: string) => {
      closeContextMenu();
      const section = data.sections.find((entry) => String(entry._id) === sectionId);
      if (!section) return;

      const nextTitle = window.prompt("Rename section", section.title ?? "");
      if (nextTitle === null) return;

      try {
        await renameSection({
          sectionId: sectionId as Id<"sections">,
          title: nextTitle,
        });
        toast.success("Section renamed");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to rename section");
      }
    },
    [closeContextMenu, data.sections, renameSection],
  );

  const handleDeleteSection = useCallback(
    async (sectionId: string) => {
      closeContextMenu();
      const section = data.sections.find((entry) => String(entry._id) === sectionId);
      if (!section) return;

      const confirmed = window.confirm(
        `Delete section "${section.title}"? This will also delete all cards inside it.`,
      );
      if (!confirmed) return;

      const removedSelectedCard = section.cards.some((card) => String(card._id) === selectedCardId);

      try {
        await removeSection({ sectionId: sectionId as Id<"sections"> });
        toast.success("Section deleted");
        if (removedSelectedCard) {
          clearSelection();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete section");
      }
    },
    [clearSelection, closeContextMenu, data.sections, removeSection, selectedCardId],
  );

  return {
    createSectionWithCard,
    handleRenameSection,
    handleDeleteSection,
  };
}

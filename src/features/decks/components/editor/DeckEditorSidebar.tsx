import { useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useCreateCard,
  useMoveCardToSection,
  useReorderCardsInSection,
  useRemoveCard,
} from "@/features/cards/api/useCardsApi";
import {
  DeckSidebarContextMenu,
} from "@/features/decks/components/editor/sidebar/DeckSidebarContextMenu";
import { DeckSidebarHeader } from "@/features/decks/components/editor/sidebar/DeckSidebarHeader";
import { DeckSidebarSections } from "@/features/decks/components/editor/sidebar/DeckSidebarSections";
import { useDeckSidebarCardActions } from "@/features/decks/components/editor/sidebar/useDeckSidebarCardActions";
import { useDeckSidebarNavigation } from "@/features/decks/components/editor/sidebar/useDeckSidebarNavigation";
import { useDeckSidebarReorderActions } from "@/features/decks/components/editor/sidebar/useDeckSidebarReorderActions";
import { useDeckSidebarSectionActions } from "@/features/decks/components/editor/sidebar/useDeckSidebarSectionActions";
import { useSidebarContextMenu } from "@/features/decks/components/editor/sidebar/useSidebarContextMenu";
import { useSidebarSensors } from "@/features/decks/components/editor/sidebar/useSidebarSensors";
import type { DeckEditShellData } from "@/features/decks/types/editor";
import {
  useCreateSection,
  useRemoveSection,
  useRenameSection,
  useReorderSections,
} from "@/features/sections/api/useSectionsApi";
import type { Id } from "@/lib/convexApi";
import type { SideIR } from "@/features/cards/side-ir/types";

type DeckEditorSidebarProps = {
  deckId: string;
  data: DeckEditShellData;
  selectedCardId?: string;
  activeSidePreview: SideIR;
  activePreviewCardId?: string;
  onSelectCard: (cardId: string | undefined) => void;
  onResetActiveSideIndex: () => void;
};

export function DeckEditorSidebar({
  deckId,
  data,
  selectedCardId,
  activeSidePreview,
  activePreviewCardId,
  onSelectCard,
  onResetActiveSideIndex,
}: DeckEditorSidebarProps) {
  const createSection = useCreateSection();
  const renameSection = useRenameSection();
  const removeSection = useRemoveSection();
  const reorderSections = useReorderSections();
  const createCard = useCreateCard();
  const reorderCards = useReorderCardsInSection();
  const moveCardToSection = useMoveCardToSection();
  const removeCard = useRemoveCard();

  const sensors = useSidebarSensors();
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const sectionIds = useMemo(
    () => data.sections.map((section) => String(section._id) as Id<"sections">),
    [data.sections],
  );

  const { contextMenu, closeContextMenu, openSectionContextMenu, openCardContextMenu } =
    useSidebarContextMenu();
  const { selectCard, clearSelection } = useDeckSidebarNavigation({
    deckId,
    onSelectCard,
    onResetActiveSideIndex,
  });
  const { onSectionDragEnd, onCardDragEnd } = useDeckSidebarReorderActions({
    deckId,
    sectionIds,
    reorderSections,
    reorderCards,
  });
  const { createSectionWithCard, handleRenameSection, handleDeleteSection } =
    useDeckSidebarSectionActions({
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
    });
  const { handleNewCardInSection, handleMoveCardToSection, handleDeleteCard } =
    useDeckSidebarCardActions({
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
    });

  const toggleSectionCollapsed = (sectionId: string) => {
    setCollapsedSections((current) => ({
      ...current,
      [sectionId]: !(current[sectionId] ?? false),
    }));
  };

  return (
    <aside className="deck-editor-sidebar h-full border-r border-border bg-background flex flex-col flex-shrink-0">
      <DeckSidebarHeader onCreateSection={createSectionWithCard} />

      <ScrollArea className="h-full p-2">
        <DeckSidebarSections
          sections={data.sections}
          sectionIds={sectionIds}
          selectedCardId={selectedCardId}
          activeSidePreview={activeSidePreview}
          activePreviewCardId={activePreviewCardId}
          collapsedSections={collapsedSections}
          sensors={sensors}
          onSectionDragEnd={onSectionDragEnd}
          onCardDragEnd={onCardDragEnd}
          onSelectCard={selectCard}
          onSectionContextMenu={openSectionContextMenu}
          onCardContextMenu={openCardContextMenu}
          onToggleCollapsed={toggleSectionCollapsed}
        />
      </ScrollArea>

      <DeckSidebarContextMenu
        contextMenu={contextMenu}
        sections={data.sections}
        onNewCardInSection={handleNewCardInSection}
        onMoveCardToSection={handleMoveCardToSection}
        onDeleteCard={handleDeleteCard}
        onRenameSection={handleRenameSection}
        onDeleteSection={handleDeleteSection}
      />
    </aside>
  );
}

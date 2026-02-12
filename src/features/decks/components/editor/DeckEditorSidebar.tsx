import { useMemo, useState, type WheelEvent } from "react";
import {
  useCreateCard,
  useMoveCardToSection,
  useRemoveCard,
  useReorderCardsInSection,
} from "@/features/cards/api/useCardsApi";
import type { SideModel } from "@/features/cards/side-model/types";
import { DeckSidebarContextMenu } from "@/features/decks/components/editor/sidebar/DeckSidebarContextMenu";
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

type DeckEditorSidebarProps = {
  deckId: string;
  data: DeckEditShellData;
  selectedCardId?: string;
  activeSidePreview: SideModel;
  activePreviewCardId?: string;
  onBeforeSelectCard?: () => Promise<void>;
  onSelectCard: (cardId: string | undefined) => void | Promise<void>;
  onResetActiveSideIndex: () => void;
};

export function DeckEditorSidebar({
  deckId,
  data,
  selectedCardId,
  activeSidePreview,
  activePreviewCardId,
  onBeforeSelectCard,
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
    onBeforeSelectCard,
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

  const scrollSidebarOnHoverWheel = (event: WheelEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const deltaY = event.deltaY;
    if (deltaY === 0) return;

    const target = event.target as HTMLElement | null;
    const nestedScrollHost = target?.closest(".remora-preview-scroll") as HTMLElement | null;
    if (nestedScrollHost && nestedScrollHost !== container) {
      const nestedMax = nestedScrollHost.scrollHeight - nestedScrollHost.clientHeight;
      if (nestedMax > 1) {
        const nestedAtTop = nestedScrollHost.scrollTop <= 1;
        const nestedAtBottom = nestedScrollHost.scrollTop >= nestedMax - 1;
        if ((deltaY < 0 && !nestedAtTop) || (deltaY > 0 && !nestedAtBottom)) {
          return;
        }
      }
    }

    const maxScrollTop = container.scrollHeight - container.clientHeight;
    if (maxScrollTop <= 1) return;
    const atTop = container.scrollTop <= 1;
    const atBottom = container.scrollTop >= maxScrollTop - 1;
    if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) return;

    event.preventDefault();
    container.scrollTop = Math.min(maxScrollTop, Math.max(0, container.scrollTop + deltaY));
  };

  return (
    <aside className="deck-editor-sidebar h-full border-r border-border bg-background flex flex-col flex-shrink-0">
      <DeckSidebarHeader onCreateSection={createSectionWithCard} />

      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2"
        data-testid="deck-sidebar-scroll"
        onWheelCapture={scrollSidebarOnHoverWheel}
      >
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
      </div>

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

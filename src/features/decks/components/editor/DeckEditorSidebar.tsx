import { Plus } from "lucide-react";
import { useMemo, useState, type WheelEvent } from "react";
import { Button } from "@/components/ui/button";
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

function canScrollWithDelta(node: HTMLElement, deltaY: number) {
  const maxScrollTop = node.scrollHeight - node.clientHeight;
  if (maxScrollTop <= 1 || deltaY === 0) return false;
  const atTop = node.scrollTop <= 1;
  const atBottom = node.scrollTop >= maxScrollTop - 1;
  if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) return false;
  return true;
}

function shouldAllowNestedScroll(
  container: HTMLElement,
  target: HTMLElement | null,
  deltaY: number,
) {
  const nestedScrollHost = target?.closest(".remora-preview-scroll") as HTMLElement | null;
  if (!nestedScrollHost || nestedScrollHost === container) {
    return false;
  }
  return canScrollWithDelta(nestedScrollHost, deltaY);
}

function scrollSidebarOnHoverWheel(event: WheelEvent<HTMLDivElement>) {
  const container = event.currentTarget;
  const deltaY = event.deltaY;
  if (deltaY === 0) return;

  if (shouldAllowNestedScroll(container, event.target as HTMLElement | null, deltaY)) {
    return;
  }
  if (!canScrollWithDelta(container, deltaY)) {
    return;
  }

  event.preventDefault();
  const maxScrollTop = container.scrollHeight - container.clientHeight;
  container.scrollTop = Math.min(maxScrollTop, Math.max(0, container.scrollTop + deltaY));
}

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

  return (
    <aside className="deck-editor-sidebar h-full border-r border-border bg-muted/50 flex flex-col flex-shrink-0">
      <DeckSidebarHeader />

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

      <div className="border-t border-border flex-shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 w-full justify-center rounded-none border-x-0 border-b-0"
          data-testid="deck-sidebar-add-section"
          onClick={() => void createSectionWithCard()}
        >
          <Plus className="h-4 w-4" /> Section
        </Button>
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

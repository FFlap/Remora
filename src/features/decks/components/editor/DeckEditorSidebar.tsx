import { Plus } from "lucide-react";
import { useMemo, useState, type WheelEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  useCreateCard,
  useMoveCardToSection,
  useRemoveCard,
  useReorderCardsInSection,
} from "@/features/cards/api/useCardsApi";
import { extractFrontSearchText } from "@/features/cards/preview";
import { asSideModel, type SideModel } from "@/features/cards/side-model/types";
import { DeckSidebarContextMenu } from "@/features/decks/components/editor/sidebar/DeckSidebarContextMenu";
import { DeckSidebarHeader } from "@/features/decks/components/editor/sidebar/DeckSidebarHeader";
import { DeckSidebarSections } from "@/features/decks/components/editor/sidebar/DeckSidebarSections";
import { useDeckSidebarCardActions } from "@/features/decks/components/editor/sidebar/useDeckSidebarCardActions";
import { useDeckSidebarNavigation } from "@/features/decks/components/editor/sidebar/useDeckSidebarNavigation";
import { useDeckSidebarReorderActions } from "@/features/decks/components/editor/sidebar/useDeckSidebarReorderActions";
import { useDeckSidebarSectionActions } from "@/features/decks/components/editor/sidebar/useDeckSidebarSectionActions";
import { useSidebarContextMenu } from "@/features/decks/components/editor/sidebar/useSidebarContextMenu";
import { useSidebarSensors } from "@/features/decks/components/editor/sidebar/useSidebarSensors";
import type { DeckEditShellData, DeckSidebarVisibleSection } from "@/features/decks/types/editor";
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

function buildVisibleSections(
  sections: DeckEditShellData["sections"],
  normalizedSearchValue: string,
): DeckSidebarVisibleSection[] {
  return sections
    .map((section) => {
      const sectionMatches =
        normalizedSearchValue.length > 0 &&
        section.title.toLowerCase().includes(normalizedSearchValue);
      const visibleCards = section.cards
        .map((card, originalIndex) => ({
          card,
          originalIndex,
        }))
        .filter(({ card }) => {
          if (normalizedSearchValue.length === 0 || sectionMatches) {
            return true;
          }

          const frontText = extractFrontSearchText(asSideModel(card.frontSide?.sideModel));
          return frontText.toLowerCase().includes(normalizedSearchValue);
        });

      return {
        section,
        visibleCards,
      };
    })
    .filter((section) => normalizedSearchValue.length === 0 || section.visibleCards.length > 0);
}

function useSidebarVisibility(sections: DeckEditShellData["sections"]) {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [searchValue, setSearchValue] = useState("");
  const sectionIds = useMemo(
    () => sections.map((section) => String(section._id) as Id<"sections">),
    [sections],
  );
  const normalizedSearchValue = searchValue.trim().toLowerCase();
  const dragEnabled = normalizedSearchValue.length === 0;
  const visibleSections = useMemo<DeckSidebarVisibleSection[]>(
    () => buildVisibleSections(sections, normalizedSearchValue),
    [sections, normalizedSearchValue],
  );
  const visibleSectionIds = useMemo(
    () => visibleSections.map((entry) => String(entry.section._id) as Id<"sections">),
    [visibleSections],
  );

  const toggleSectionCollapsed = (sectionId: string) => {
    setCollapsedSections((current) => ({
      ...current,
      [sectionId]: !(current[sectionId] ?? false),
    }));
  };

  return {
    collapsedSections,
    searchValue,
    setSearchValue,
    sectionIds,
    dragEnabled,
    visibleSections,
    visibleSectionIds,
    toggleSectionCollapsed,
  };
}

function DeckEditorSidebarLayout({
  searchValue,
  setSearchValue,
  visibleSections,
  visibleSectionIds,
  dragEnabled,
  selectedCardId,
  activeSidePreview,
  activePreviewCardId,
  collapsedSections,
  sensors,
  onSectionDragEnd,
  onCardDragEnd,
  onSelectCard,
  onSectionContextMenu,
  onCardContextMenu,
  onToggleCollapsed,
  onCreateSection,
  contextMenu,
  sections,
  onNewCardInSection,
  onMoveCardToSection,
  onDeleteCard,
  onRenameSection,
  onDeleteSection,
}: {
  searchValue: string;
  setSearchValue: (value: string) => void;
  visibleSections: DeckSidebarVisibleSection[];
  visibleSectionIds: Id<"sections">[];
  dragEnabled: boolean;
  selectedCardId?: string;
  activeSidePreview: SideModel;
  activePreviewCardId?: string;
  collapsedSections: Record<string, boolean>;
  sensors: ReturnType<typeof useSidebarSensors>;
  onSectionDragEnd: ReturnType<typeof useDeckSidebarReorderActions>["onSectionDragEnd"];
  onCardDragEnd: ReturnType<typeof useDeckSidebarReorderActions>["onCardDragEnd"];
  onSelectCard: ReturnType<typeof useDeckSidebarNavigation>["selectCard"];
  onSectionContextMenu: ReturnType<typeof useSidebarContextMenu>["openSectionContextMenu"];
  onCardContextMenu: ReturnType<typeof useSidebarContextMenu>["openCardContextMenu"];
  onToggleCollapsed: (sectionId: string) => void;
  onCreateSection: () => Promise<void>;
  contextMenu: ReturnType<typeof useSidebarContextMenu>["contextMenu"];
  sections: DeckEditShellData["sections"];
  onNewCardInSection: ReturnType<typeof useDeckSidebarCardActions>["handleNewCardInSection"];
  onMoveCardToSection: ReturnType<typeof useDeckSidebarCardActions>["handleMoveCardToSection"];
  onDeleteCard: ReturnType<typeof useDeckSidebarCardActions>["handleDeleteCard"];
  onRenameSection: ReturnType<typeof useDeckSidebarSectionActions>["handleRenameSection"];
  onDeleteSection: ReturnType<typeof useDeckSidebarSectionActions>["handleDeleteSection"];
}) {
  return (
    <aside className="deck-editor-sidebar h-full border-r border-border bg-muted/50 flex flex-col flex-shrink-0">
      <DeckSidebarHeader searchValue={searchValue} onSearchChange={setSearchValue} />

      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2"
        data-testid="deck-sidebar-scroll"
        onWheelCapture={scrollSidebarOnHoverWheel}
      >
        {visibleSections.length > 0 ? (
          <DeckSidebarSections
            sections={visibleSections}
            sectionIds={visibleSectionIds}
            dragEnabled={dragEnabled}
            selectedCardId={selectedCardId}
            activeSidePreview={activeSidePreview}
            activePreviewCardId={activePreviewCardId}
            collapsedSections={collapsedSections}
            sensors={sensors}
            onSectionDragEnd={onSectionDragEnd}
            onCardDragEnd={onCardDragEnd}
            onSelectCard={onSelectCard}
            onSectionContextMenu={onSectionContextMenu}
            onCardContextMenu={onCardContextMenu}
            onToggleCollapsed={onToggleCollapsed}
          />
        ) : (
          <p
            data-testid="deck-sidebar-no-results"
            className="px-2 py-3 text-xs text-muted-foreground"
          >
            No matching cards.
          </p>
        )}
      </div>

      <div className="border-t border-border flex-shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 w-full justify-center rounded-none border-x-0 border-b-0"
          data-testid="deck-sidebar-add-section"
          onClick={() => void onCreateSection()}
        >
          <Plus className="h-4 w-4" /> Section
        </Button>
      </div>

      <DeckSidebarContextMenu
        contextMenu={contextMenu}
        sections={sections}
        onNewCardInSection={onNewCardInSection}
        onMoveCardToSection={onMoveCardToSection}
        onDeleteCard={onDeleteCard}
        onRenameSection={onRenameSection}
        onDeleteSection={onDeleteSection}
      />
    </aside>
  );
}

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
  const {
    collapsedSections,
    searchValue,
    setSearchValue,
    sectionIds,
    dragEnabled,
    visibleSections,
    visibleSectionIds,
    toggleSectionCollapsed,
  } = useSidebarVisibility(data.sections);

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

  return (
    <DeckEditorSidebarLayout
      searchValue={searchValue}
      setSearchValue={setSearchValue}
      visibleSections={visibleSections}
      visibleSectionIds={visibleSectionIds}
      dragEnabled={dragEnabled}
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
      onCreateSection={createSectionWithCard}
      contextMenu={contextMenu}
      sections={data.sections}
      onNewCardInSection={handleNewCardInSection}
      onMoveCardToSection={handleMoveCardToSection}
      onDeleteCard={handleDeleteCard}
      onRenameSection={handleRenameSection}
      onDeleteSection={handleDeleteSection}
    />
  );
}

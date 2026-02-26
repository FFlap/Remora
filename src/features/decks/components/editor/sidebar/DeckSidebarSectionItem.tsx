import type { DragEndEvent, useSensors } from "@dnd-kit/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { DeckSidebarCardList } from "@/features/decks/components/editor/sidebar/DeckSidebarCardList";
import { SortableRow } from "@/features/decks/components/editor/sidebar/SortableRow";
import type { DeckEditShellSection, DeckSidebarVisibleCard } from "@/features/decks/types/editor";
import type { Id } from "@/lib/convexApi";

type DeckSidebarSectionItemProps = {
  section: DeckEditShellSection;
  visibleCards: DeckSidebarVisibleCard[];
  sectionId: string;
  dragEnabled: boolean;
  isCollapsed: boolean;
  selectedCardId?: string;
  activeSidePreview: import("@/features/cards/side-model/types").SideModel;
  activePreviewCardId?: string;
  sensors: ReturnType<typeof useSensors>;
  onToggleCollapsed: (sectionId: string) => void;
  onSelectCard: (cardId: string) => void | Promise<void>;
  onCardDragEnd: (
    sectionId: Id<"sections">,
    cardIds: Id<"cards">[],
    event: DragEndEvent,
  ) => Promise<void>;
  onSectionContextMenu: (event: ReactMouseEvent<HTMLElement>, sectionId: string) => void;
  onCardContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    sectionId: string,
    cardId: string,
    cardIndex: number,
  ) => void;
};

export function DeckSidebarSectionItem({
  section,
  visibleCards,
  sectionId,
  dragEnabled,
  isCollapsed,
  selectedCardId,
  activeSidePreview,
  activePreviewCardId,
  sensors,
  onToggleCollapsed,
  onSelectCard,
  onCardDragEnd,
  onSectionContextMenu,
  onCardContextMenu,
}: DeckSidebarSectionItemProps) {
  const isActiveSection = visibleCards.some(({ card }) => String(card._id) === selectedCardId);
  const content = (
    <div className="overflow-hidden" data-testid="deck-sidebar-section-item">
      <button
        type="button"
        data-testid="deck-sidebar-section-header"
        className="w-full bg-transparent px-2 py-1.5 text-left"
        onContextMenu={(event) => onSectionContextMenu(event, sectionId)}
        onClick={() => onToggleCollapsed(sectionId)}
      >
        <span className="flex items-center gap-1">
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          <span className="flex-1 truncate text-xs font-semibold tracking-wide">
            {section.title}
          </span>
          {isActiveSection ? (
            <span className="rounded bg-black px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-white">
              active
            </span>
          ) : null}
        </span>
        <span className="pl-5 text-[10px] text-muted-foreground">
          {visibleCards.length} card{visibleCards.length === 1 ? "" : "s"}
          {!isCollapsed && dragEnabled ? " - drag to reorder" : ""}
        </span>
      </button>

      {!isCollapsed ? (
        <div className="p-2">
          <DeckSidebarCardList
            section={section}
            cards={visibleCards}
            sectionId={sectionId}
            dragEnabled={dragEnabled}
            selectedCardId={selectedCardId}
            activeSidePreview={activeSidePreview}
            activePreviewCardId={activePreviewCardId}
            sensors={sensors}
            onCardDragEnd={onCardDragEnd}
            onSelectCard={onSelectCard}
            onCardContextMenu={onCardContextMenu}
          />
        </div>
      ) : null}
    </div>
  );

  if (!dragEnabled) {
    return content;
  }

  return <SortableRow id={sectionId}>{content}</SortableRow>;
}

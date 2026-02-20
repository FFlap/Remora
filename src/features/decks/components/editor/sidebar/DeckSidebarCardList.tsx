import { closestCenter, DndContext, type DragEndEvent, type useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { MouseEvent as ReactMouseEvent } from "react";
import { SideCardPreview } from "@/features/cards/components/SideCardPreview";
import { asSideModel, type SideModel } from "@/features/cards/side-model/types";
import { VERTICAL_BOUNDED_MODIFIERS } from "@/features/decks/components/editor/dnd/dragConstraints";
import { SortableRow } from "@/features/decks/components/editor/sidebar/SortableRow";
import type { DeckEditShellSection, DeckSidebarVisibleCard } from "@/features/decks/types/editor";
import type { Id } from "@/lib/convexApi";
import { cn } from "@/lib/utils";

type DeckSidebarCardListProps = {
  section: DeckEditShellSection;
  cards: DeckSidebarVisibleCard[];
  sectionId: string;
  dragEnabled: boolean;
  selectedCardId?: string;
  activeSidePreview: SideModel;
  activePreviewCardId?: string;
  sensors: ReturnType<typeof useSensors>;
  onCardDragEnd: (
    sectionId: Id<"sections">,
    cardIds: Id<"cards">[],
    event: DragEndEvent,
  ) => Promise<void>;
  onSelectCard: (cardId: string) => void | Promise<void>;
  onCardContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    sectionId: string,
    cardId: string,
    cardIndex: number,
  ) => void;
};

export function DeckSidebarCardList({
  section,
  cards,
  sectionId,
  dragEnabled,
  selectedCardId,
  activeSidePreview,
  activePreviewCardId,
  sensors,
  onCardDragEnd,
  onSelectCard,
  onCardContextMenu,
}: DeckSidebarCardListProps) {
  const cardIds = cards.map(({ card }) => card._id);
  const renderedRows = cards.map(({ card, originalIndex }) => {
    const cardId = String(card._id);
    const isActive = cardId === selectedCardId;
    const hasLivePreview = isActive && activePreviewCardId === cardId;
    const side = hasLivePreview ? activeSidePreview : asSideModel(card.frontSide?.sideModel);
    const row = (
      <button
        type="button"
        data-testid={`card-sidebar-preview-${card._id}`}
        onContextMenu={(event) => onCardContextMenu(event, sectionId, cardId, originalIndex)}
        onClick={() => {
          void onSelectCard(cardId);
        }}
        className={cn(
          "relative w-full rounded-lg p-1 text-left transition-all",
          isActive ? "opacity-100" : "opacity-80 hover:opacity-100",
        )}
      >
        <span className="pointer-events-none absolute left-3 top-3 z-20 rounded bg-black/85 px-2 py-1 text-[11px] font-semibold leading-none text-white shadow-sm">
          {originalIndex + 1}
        </span>
        <SideCardPreview
          side={side}
          compact
          className={cn(
            "w-full transition-all",
            isActive
              ? "border-foreground ring-2 ring-foreground/25"
              : "border-border hover:border-foreground/45",
          )}
          ariaHidden
        />
        <span className="sr-only">Card {originalIndex + 1}</span>
      </button>
    );

    if (!dragEnabled) {
      return <div key={card._id}>{row}</div>;
    }

    return (
      <SortableRow key={card._id} id={cardId}>
        {row}
      </SortableRow>
    );
  });

  if (!dragEnabled) {
    return (
      <div className="space-y-2" data-testid="deck-sidebar-card-list">
        {renderedRows}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={VERTICAL_BOUNDED_MODIFIERS}
      onDragEnd={(event) => {
        void onCardDragEnd(section._id, cardIds, event);
      }}
    >
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2" data-testid="deck-sidebar-card-list">
          {renderedRows}
        </div>
      </SortableContext>
    </DndContext>
  );
}

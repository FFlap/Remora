import { closestCenter, DndContext, type DragEndEvent, type useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { MouseEvent as ReactMouseEvent } from "react";
import { SideCardPreview } from "@/features/cards/components/SideCardPreview";
import { asSideIR, type SideIR } from "@/features/cards/side-ir/types";
import { SortableRow } from "@/features/decks/components/editor/sidebar/SortableRow";
import type { DeckEditShellSection } from "@/features/decks/types/editor";
import type { Id } from "@/lib/convexApi";
import { cn } from "@/lib/utils";

type DeckSidebarCardListProps = {
  section: DeckEditShellSection;
  sectionId: string;
  selectedCardId?: string;
  activeSidePreview: SideIR;
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
  sectionId,
  selectedCardId,
  activeSidePreview,
  activePreviewCardId,
  sensors,
  onCardDragEnd,
  onSelectCard,
  onCardContextMenu,
}: DeckSidebarCardListProps) {
  const cardIds = section.cards.map((card) => card._id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(event) => {
        void onCardDragEnd(section._id, cardIds, event);
      }}
    >
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {section.cards.map((card, index) => {
            const cardId = String(card._id);
            const isActive = cardId === selectedCardId;
            const hasLivePreview = isActive && activePreviewCardId === cardId;
            const side = hasLivePreview ? activeSidePreview : asSideIR(card.frontSide?.sideIR);

            return (
              <SortableRow key={card._id} id={cardId}>
                <button
                  type="button"
                  data-testid={`card-sidebar-preview-${card._id}`}
                  onContextMenu={(event) => onCardContextMenu(event, sectionId, cardId, index)}
                  onClick={() => {
                    void onSelectCard(cardId);
                  }}
                  className={cn(
                    "relative w-full rounded-lg p-1 text-left transition-all",
                    isActive ? "opacity-100" : "opacity-80 hover:opacity-100",
                  )}
                >
                  <span className="pointer-events-none absolute left-3 top-3 z-20 rounded bg-black/85 px-2 py-1 text-[11px] font-semibold leading-none text-white shadow-sm">
                    {index + 1}
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
                  <span className="sr-only">Card {index + 1}</span>
                </button>
              </SortableRow>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

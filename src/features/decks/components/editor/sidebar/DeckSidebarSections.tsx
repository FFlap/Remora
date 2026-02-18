import { closestCenter, DndContext, type DragEndEvent, type useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { MouseEvent as ReactMouseEvent } from "react";
import { VERTICAL_BOUNDED_MODIFIERS } from "@/features/decks/components/editor/dnd/dragConstraints";
import { DeckSidebarSectionItem } from "@/features/decks/components/editor/sidebar/DeckSidebarSectionItem";
import type { DeckEditShellSection } from "@/features/decks/types/editor";
import type { Id } from "@/lib/convexApi";

type DeckSidebarSectionsProps = {
  sections: DeckEditShellSection[];
  sectionIds: Id<"sections">[];
  selectedCardId?: string;
  activeSidePreview: import("@/features/cards/side-model/types").SideModel;
  activePreviewCardId?: string;
  collapsedSections: Record<string, boolean>;
  sensors: ReturnType<typeof useSensors>;
  onSectionDragEnd: (event: DragEndEvent) => Promise<void>;
  onCardDragEnd: (
    sectionId: Id<"sections">,
    cardIds: Id<"cards">[],
    event: DragEndEvent,
  ) => Promise<void>;
  onSelectCard: (cardId: string) => void | Promise<void>;
  onSectionContextMenu: (event: ReactMouseEvent<HTMLElement>, sectionId: string) => void;
  onCardContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    sectionId: string,
    cardId: string,
    cardIndex: number,
  ) => void;
  onToggleCollapsed: (sectionId: string) => void;
};

export function DeckSidebarSections({
  sections,
  sectionIds,
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
}: DeckSidebarSectionsProps) {
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={VERTICAL_BOUNDED_MODIFIERS}
      onDragEnd={(event) => {
        void onSectionDragEnd(event);
      }}
    >
      <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2" data-testid="deck-sidebar-sections-list">
          {sections.map((section) => {
            const sectionId = String(section._id);

            return (
              <DeckSidebarSectionItem
                key={section._id}
                section={section}
                sectionId={sectionId}
                isCollapsed={collapsedSections[sectionId] ?? false}
                selectedCardId={selectedCardId}
                activeSidePreview={activeSidePreview}
                activePreviewCardId={activePreviewCardId}
                sensors={sensors}
                onToggleCollapsed={onToggleCollapsed}
                onSelectCard={onSelectCard}
                onCardDragEnd={onCardDragEnd}
                onSectionContextMenu={onSectionContextMenu}
                onCardContextMenu={onCardContextMenu}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

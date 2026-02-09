import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  type useSensors,
} from "@dnd-kit/core";
import type { MouseEvent as ReactMouseEvent } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DeckSidebarSectionItem } from "@/features/decks/components/editor/sidebar/DeckSidebarSectionItem";
import type { DeckEditShellSection } from "@/features/decks/types/editor";
import type { Id } from "@/lib/convexApi";

type DeckSidebarSectionsProps = {
  sections: DeckEditShellSection[];
  sectionIds: Id<"sections">[];
  selectedCardId?: string;
  activeSidePreview: import("@/features/cards/side-ir/types").SideIR;
  activePreviewCardId?: string;
  collapsedSections: Record<string, boolean>;
  sensors: ReturnType<typeof useSensors>;
  onSectionDragEnd: (event: DragEndEvent) => Promise<void>;
  onCardDragEnd: (sectionId: Id<"sections">, cardIds: Id<"cards">[], event: DragEndEvent) => Promise<void>;
  onSelectCard: (cardId: string) => void;
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
      onDragEnd={(event) => {
        void onSectionDragEnd(event);
      }}
    >
      <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
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

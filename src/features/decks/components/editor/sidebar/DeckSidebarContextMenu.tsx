import { PenSquare, Plus, Trash2 } from "lucide-react";
import type { SidebarContextMenuState } from "@/features/decks/components/editor/sidebar/types";
import type { DeckEditShellSection } from "@/features/decks/types/editor";
import { cn } from "@/lib/utils";

function CardContextMenuActions({
  contextMenu,
  sections,
  onMoveCardToSection,
  onDeleteCard,
}: {
  contextMenu: Exclude<SidebarContextMenuState, null>;
  sections: DeckEditShellSection[];
  onMoveCardToSection: (cardId: string, sectionId: string) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
}) {
  return (
    <>
      <div className="my-1 border-t border-border" />
      {sections.map((section) => {
        const targetSectionId = String(section._id);
        const isCurrent = targetSectionId === contextMenu.sectionId;

        return (
          <button
            key={section._id}
            type="button"
            disabled={isCurrent}
            onClick={() => {
              if (!contextMenu.cardId) return;
              void onMoveCardToSection(contextMenu.cardId, targetSectionId);
            }}
            className={cn(
              "w-full px-3 py-1.5 text-left text-xs",
              isCurrent
                ? "cursor-not-allowed bg-muted/50 text-muted-foreground"
                : "hover:bg-accent",
            )}
          >
            Move to {section.title}
            {isCurrent ? " (current)" : ""}
          </button>
        );
      })}
      <div className="my-1 border-t border-border" />
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
        onClick={() => {
          if (!contextMenu.cardId) return;
          void onDeleteCard(contextMenu.cardId);
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete card
      </button>
    </>
  );
}

function SectionContextMenuActions({
  contextMenu,
  onRenameSection,
  onDeleteSection,
}: {
  contextMenu: Exclude<SidebarContextMenuState, null>;
  onRenameSection: (sectionId: string) => Promise<void>;
  onDeleteSection: (sectionId: string) => Promise<void>;
}) {
  return (
    <>
      <div className="my-1 border-t border-border" />
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
        onClick={() => {
          void onRenameSection(contextMenu.sectionId);
        }}
      >
        <PenSquare className="h-3.5 w-3.5" />
        Rename section
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
        onClick={() => {
          void onDeleteSection(contextMenu.sectionId);
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete section
      </button>
    </>
  );
}

export function DeckSidebarContextMenu({
  contextMenu,
  sections,
  onNewCardInSection,
  onMoveCardToSection,
  onDeleteCard,
  onRenameSection,
  onDeleteSection,
}: {
  contextMenu: SidebarContextMenuState;
  sections: DeckEditShellSection[];
  onNewCardInSection: (sectionId: string, insertIndex: number) => Promise<void>;
  onMoveCardToSection: (cardId: string, sectionId: string) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onRenameSection: (sectionId: string) => Promise<void>;
  onDeleteSection: (sectionId: string) => Promise<void>;
}) {
  if (!contextMenu) {
    return null;
  }

  return (
    <div
      className="fixed z-50 min-w-[170px] rounded-lg border border-border bg-background py-1 shadow-lg"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      role="menu"
      aria-label="Sidebar context menu"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
        onClick={() => {
          void onNewCardInSection(contextMenu.sectionId, contextMenu.insertIndex);
        }}
      >
        <Plus className="h-3.5 w-3.5" />
        New card
      </button>

      {contextMenu.cardId ? (
        <CardContextMenuActions
          contextMenu={contextMenu}
          sections={sections}
          onMoveCardToSection={onMoveCardToSection}
          onDeleteCard={onDeleteCard}
        />
      ) : (
        <SectionContextMenuActions
          contextMenu={contextMenu}
          onRenameSection={onRenameSection}
          onDeleteSection={onDeleteSection}
        />
      )}
    </div>
  );
}

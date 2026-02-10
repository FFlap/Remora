import { PenSquare, Plus, Redo2, Shapes, Trash2, Undo2 } from "lucide-react";
import { lazy, Suspense, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { SideCardPreview } from "@/features/cards/components/SideCardPreview";
import type { SideOperation } from "@/features/cards/side-ir/ops";
import { asSideIR, type SideIR } from "@/features/cards/side-ir/types";
import type { DeckEditorCardData } from "@/features/decks/types/editor";
import type { Doc } from "@/lib/convexApi";
import { cn } from "@/lib/utils";

const QuickEditor = lazy(async () => {
  const module = await import("@/features/cards/editors/QuickEditor");
  return { default: module.QuickEditor };
});

const CreativeEditor = lazy(async () => {
  const module = await import("@/features/cards/editors/CreativeEditor");
  return { default: module.CreativeEditor };
});

type SideHistoryLike = {
  present: SideIR;
  apply: (
    operations: SideOperation[],
    meta?: {
      source?: "quick" | "creative" | "system";
      batchKey?: string;
      coalesceMs?: number;
    },
  ) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

type DeckEditorWorkspaceProps = {
  selectedCard: NonNullable<DeckEditorCardData>["card"] | null | undefined;
  selectedCardData: DeckEditorCardData | undefined;
  sideHistory: SideHistoryLike;
  editorMode: "quick" | "creative";
  setEditorMode: (mode: "quick" | "creative") => void;
  sortedSides: Doc<"cardSides">[];
  activeSideIndex: number;
  onSelectSide: (index: number) => void | Promise<void>;
  onAddSide: () => Promise<void>;
  onDeleteSide: () => Promise<void>;
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Workspace intentionally composes mode controls, editor region, and side tray in one UI shell.
export function DeckEditorWorkspace({
  selectedCard,
  selectedCardData,
  sideHistory,
  editorMode,
  setEditorMode,
  sortedSides,
  activeSideIndex,
  onSelectSide,
  onAddSide,
  onDeleteSide,
}: DeckEditorWorkspaceProps) {
  const activeSide = sortedSides.find((side) => side.index === activeSideIndex) ?? sortedSides[0];
  const editorKey = `${selectedCard?._id ?? "none"}:${activeSide?._id ?? "none"}:${editorMode}`;
  const applyArray = useCallback(
    (operations: SideOperation[]) => {
      sideHistory.apply(operations);
    },
    [sideHistory],
  );

  if (!selectedCard) {
    return (
      <main className="flex-1 min-w-0 flex items-center justify-center text-sm text-muted-foreground">
        Select a card to edit.
      </main>
    );
  }

  if (!selectedCardData) {
    return (
      <main className="flex-1 min-w-0 flex items-center justify-center text-sm text-muted-foreground">
        Loading card...
      </main>
    );
  }

  return (
    <main className="flex-1 min-w-0 flex flex-col overflow-hidden transition-all duration-200">
      <div className="deck-editor-shell-grid flex-1 min-h-0">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end border-b border-border px-3 md:px-4 lg:px-6">
          <div />

          <div className="flex items-end justify-center">
            <button
              type="button"
              data-testid="mode-quick-button"
              onClick={() => setEditorMode("quick")}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-colors",
                editorMode === "quick"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="inline-flex items-center gap-1">
                <PenSquare className="h-4 w-4" />
                Quick Create
              </span>
              {editorMode === "quick" ? (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
              ) : null}
            </button>
            <button
              type="button"
              data-testid="mode-creative-button"
              onClick={() => setEditorMode("creative")}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-colors",
                editorMode === "creative"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="inline-flex items-center gap-1">
                <Shapes className="h-4 w-4" />
                Creative Create
              </span>
              {editorMode === "creative" ? (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
              ) : null}
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 py-1">
            <Button
              size="sm"
              variant="outline"
              onClick={sideHistory.undo}
              disabled={!sideHistory.canUndo}
            >
              <Undo2 className="h-4 w-4" /> Undo
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={sideHistory.redo}
              disabled={!sideHistory.canRedo}
            >
              <Redo2 className="h-4 w-4" /> Redo
            </Button>
          </div>
        </div>

        <div
          className="deck-editor-shell-content min-h-0 overflow-y-auto p-3 md:p-4 lg:p-5 xl:p-6"
          data-testid="editor-content-row"
        >
          <Suspense
            fallback={
              <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-muted-foreground">
                Loading editor...
              </div>
            }
          >
            {editorMode === "quick" ? (
              <QuickEditor key={editorKey} side={sideHistory.present} onApply={applyArray} />
            ) : (
              <CreativeEditor key={editorKey} side={sideHistory.present} onApply={applyArray} />
            )}
          </Suspense>
        </div>

        <div
          className="deck-editor-side-tray-row border-t border-border bg-muted/20 px-3 md:px-4 py-3"
          data-testid="editor-side-tray-row"
        >
          <div className="flex flex-wrap items-start gap-3 md:flex-nowrap md:items-center">
            <div className="side-tray-scroll flex-1 overflow-x-auto" data-testid="side-tray">
              <div className="side-tray-strip flex min-w-max items-start gap-3 pr-2">
                {sortedSides.map((side) => {
                  const isActive = side.index === activeSideIndex;
                  const traySide = isActive ? sideHistory.present : asSideIR(side.sideIR);
                  return (
                    <button
                      key={side._id}
                      type="button"
                      data-testid={`side-tray-item-${side.index}`}
                      aria-pressed={isActive}
                      onClick={() => {
                        void onSelectSide(side.index);
                      }}
                      className={cn(
                        "side-tray-item rounded-lg border bg-background p-2 text-left transition-all",
                        isActive
                          ? "border-foreground ring-2 ring-foreground/20"
                          : "border-border hover:border-foreground/50",
                      )}
                    >
                      <SideCardPreview side={traySide} compact className="w-full" ariaHidden />
                      <p className="mt-1.5 truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                        Side {side.index + 1}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                data-testid="side-tray-add-side"
                onClick={onAddSide}
              >
                <Plus className="h-4 w-4" /> Add Side
              </Button>
              <Button
                size="sm"
                variant="outline"
                data-testid="side-tray-delete-side"
                disabled={sortedSides.length <= 1}
                onClick={onDeleteSide}
              >
                <Trash2 className="h-4 w-4" /> Delete Side
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

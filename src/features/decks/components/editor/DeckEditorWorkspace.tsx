import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PenSquare, Plus, Redo2, Shapes, Trash2, Undo2 } from "lucide-react";
import {
  lazy,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type WheelEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { SideCardPreview } from "@/features/cards/components/SideCardPreview";
import type { SideOperation } from "@/features/cards/side-model/ops";
import { asSideModel, type SideModel } from "@/features/cards/side-model/types";
import { HORIZONTAL_BOUNDED_MODIFIERS } from "@/features/decks/components/editor/dnd/dragConstraints";
import type { DeckEditorCardData } from "@/features/decks/types/editor";
import type { Doc, Id } from "@/lib/convexApi";
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
  present: SideModel;
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
  onDeleteSide: (sideIndex: number) => Promise<void>;
  onReorderSides: (orderedSideIds: Id<"cardSides">[]) => Promise<void>;
};

type SideTrayContextMenuState = {
  x: number;
  y: number;
  sideIndex: number;
} | null;

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
  onReorderSides,
}: DeckEditorWorkspaceProps) {
  const activeSide = sortedSides.find((side) => side.index === activeSideIndex) ?? sortedSides[0];
  const editorKey = `${selectedCard?._id ?? "none"}:${activeSide?._id ?? "none"}:${editorMode}`;
  const sideTrayScrollRef = useRef<HTMLDivElement | null>(null);
  const sideTrayStripRef = useRef<HTMLDivElement | null>(null);
  const sideTrayContextMenuRef = useRef<HTMLDivElement | null>(null);
  const [pinAddTileRight, setPinAddTileRight] = useState(false);
  const [sideContextMenu, setSideContextMenu] = useState<SideTrayContextMenuState>(null);
  const sideIds = sortedSides.map((side) => String(side._id));
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );
  const applyArray = useCallback(
    (
      operations: SideOperation[],
      meta?: {
        source?: "quick" | "creative" | "system";
        batchKey?: string;
        coalesceMs?: number;
      },
    ) => {
      sideHistory.apply(operations, meta);
    },
    [sideHistory],
  );
  const handleSideTrayWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const tray = event.currentTarget;
    if (tray.scrollWidth <= tray.clientWidth + 1) {
      return;
    }

    let deltaFactor = 1;
    if (event.deltaMode === 1) {
      deltaFactor = 16;
    } else if (event.deltaMode === 2) {
      deltaFactor = tray.clientWidth;
    }
    const deltaX = event.deltaX * deltaFactor;
    const deltaY = event.deltaY * deltaFactor;
    const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.5) {
      return;
    }

    const before = tray.scrollLeft;
    const maxScrollLeft = Math.max(0, tray.scrollWidth - tray.clientWidth);
    const nextScrollLeft = Math.min(maxScrollLeft, Math.max(0, before + delta));
    if (Math.abs(nextScrollLeft - before) < 0.5) {
      return;
    }

    event.preventDefault();
    tray.scrollLeft = nextScrollLeft;
  }, []);
  const closeSideContextMenu = useCallback(() => {
    setSideContextMenu(null);
  }, []);

  const openSideContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>, sideIndex: number) => {
      event.preventDefault();
      event.stopPropagation();
      setSideContextMenu({
        x: event.clientX,
        y: event.clientY,
        sideIndex,
      });
    },
    [],
  );
  const handleSideDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;

      const oldIndex = sideIds.indexOf(String(active.id));
      const newIndex = sideIds.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;

      closeSideContextMenu();
      const orderedSideIds = arrayMove(sideIds, oldIndex, newIndex) as Id<"cardSides">[];
      void onReorderSides(orderedSideIds);
    },
    [closeSideContextMenu, onReorderSides, sideIds],
  );
  const recomputeAddTilePinning = useCallback(() => {
    const tray = sideTrayScrollRef.current;
    const strip = sideTrayStripRef.current;
    if (!tray || !strip) return;

    const sideCount = sortedSides.length;
    if (sideCount <= 0) {
      setPinAddTileRight(false);
      return;
    }

    const trayWidth = tray.clientWidth;
    if (!Number.isFinite(trayWidth) || trayWidth <= 1) return;

    const stripStyle = getComputedStyle(strip);
    const gapPx = Number.parseFloat(stripStyle.columnGap || stripStyle.gap || "0");
    const firstSideItem = strip.querySelector(
      '[data-testid^="side-tray-item-"]',
    ) as HTMLElement | null;
    const addTileWidth = firstSideItem?.getBoundingClientRect().width ?? 146;
    const inlineOverflow = tray.scrollWidth > trayWidth + 1;
    const projectedInlineWidth =
      strip.scrollWidth + addTileWidth + (strip.scrollWidth > 1 ? Math.max(0, gapPx) : 0);
    const wouldOverflowIfInline = projectedInlineWidth > trayWidth + 1;

    setPinAddTileRight((current) => (current ? wouldOverflowIfInline : inlineOverflow));
  }, [sortedSides.length]);

  useEffect(() => {
    const tray = sideTrayScrollRef.current;
    const strip = sideTrayStripRef.current;
    if (!tray || !strip) return;

    const observer = new ResizeObserver(() => {
      recomputeAddTilePinning();
    });
    observer.observe(tray);
    observer.observe(strip);
    const rafId = window.requestAnimationFrame(() => {
      recomputeAddTilePinning();
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [recomputeAddTilePinning]);

  useEffect(() => {
    if (!sideContextMenu) return;

    const onWindowMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && sideTrayContextMenuRef.current?.contains(target)) {
        return;
      }
      closeSideContextMenu();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSideContextMenu();
      }
    };

    window.addEventListener("mousedown", onWindowMouseDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onWindowMouseDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [closeSideContextMenu, sideContextMenu]);

  const addSideTile = (
    <button
      type="button"
      data-testid="side-tray-add-side"
      aria-label="Add Side"
      onClick={() => {
        void onAddSide();
      }}
      className="group side-tray-item side-tray-add-item rounded-lg bg-transparent p-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
    >
      <div
        className="side-tray-add-preview"
        style={{
          aspectRatio: String(
            sideHistory.present.layout.quickLayout.cardRatio > 0
              ? sideHistory.present.layout.quickLayout.cardRatio
              : 1.6,
          ),
        }}
        aria-hidden="true"
      >
        <Plus className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
      </div>
      <p
        className="mt-1.5 truncate text-[10px] uppercase tracking-wider text-transparent select-none"
        aria-hidden="true"
      >
        Add Side
      </p>
      <span className="sr-only">Add Side</span>
    </button>
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
    <main className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden transition-all duration-200">
      <div className="deck-editor-shell-grid flex-1 min-h-0">
        <div
          className="deck-editor-top-row grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end border-b border-border px-3 md:px-4 lg:px-6"
          data-testid="editor-top-controls"
        >
          <div className="deck-editor-top-row-start" />

          <div
            className="deck-editor-top-row-center flex items-end justify-center"
            data-testid="editor-mode-controls"
          >
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

          <div
            className="deck-editor-top-row-actions flex items-center justify-end gap-2 py-1"
            data-testid="editor-history-controls"
          >
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
          className={cn(
            "deck-editor-shell-content min-h-0 overflow-x-auto overflow-y-auto",
            editorMode === "quick"
              ? "pt-0 pl-0 pr-3 pb-0 md:pr-4 md:pb-0 lg:pr-5 lg:pb-0 xl:pr-6 xl:pb-0"
              : "p-3 md:p-4 lg:p-5 xl:p-6",
          )}
          data-testid="editor-content-row"
        >
          <div className="deck-editor-shell-content-inner flex h-full min-h-0 min-w-0 flex-col">
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
        </div>

        <div
          className="deck-editor-side-tray-row border-t border-border bg-muted/20 px-3 md:px-4 py-3"
          data-testid="editor-side-tray-row"
        >
          <div className="deck-editor-side-tray-inner flex w-full min-w-0 flex-wrap items-start gap-3 md:flex-nowrap md:items-center">
            <div
              ref={sideTrayScrollRef}
              className="side-tray-scroll flex-1 min-w-0 overflow-x-auto"
              data-testid="side-tray"
              onWheel={handleSideTrayWheel}
            >
              <div
                ref={sideTrayStripRef}
                className="side-tray-strip flex w-max min-w-max flex-nowrap items-start gap-3 pr-2"
              >
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={HORIZONTAL_BOUNDED_MODIFIERS}
                  onDragStart={() => {
                    closeSideContextMenu();
                  }}
                  onDragEnd={handleSideDragEnd}
                >
                  <SortableContext items={sideIds} strategy={horizontalListSortingStrategy}>
                    <div
                      className="side-tray-sortable-strip flex w-max min-w-max flex-nowrap items-start gap-3"
                      data-testid="side-tray-sortable-strip"
                    >
                      {sortedSides.map((side) => {
                        const isActive = side.index === activeSideIndex;
                        const traySide = isActive
                          ? sideHistory.present
                          : asSideModel(side.sideModel);
                        return (
                          <SortableTraySide key={side._id} id={String(side._id)}>
                            <button
                              type="button"
                              data-testid={`side-tray-item-${side.index}`}
                              aria-pressed={isActive}
                              onClick={() => {
                                void onSelectSide(side.index);
                              }}
                              onContextMenu={(event) => openSideContextMenu(event, side.index)}
                              className={cn(
                                "side-tray-item rounded-lg bg-transparent p-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
                              )}
                            >
                              <SideCardPreview
                                side={traySide}
                                compact
                                className={cn(
                                  "w-full transition-colors",
                                  isActive
                                    ? "border-foreground ring-2 ring-foreground/20"
                                    : "hover:border-foreground/50",
                                )}
                                ariaHidden
                              />
                              <p className="mt-1.5 truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                                Side {side.index + 1}
                              </p>
                            </button>
                          </SortableTraySide>
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
                {!pinAddTileRight ? addSideTile : null}
              </div>
            </div>

            {pinAddTileRight ? (
              <div className="deck-editor-side-tray-actions flex items-center gap-2">
                {addSideTile}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {sideContextMenu ? (
        <div
          ref={sideTrayContextMenuRef}
          className="fixed z-50 min-w-[170px] rounded-lg border border-border bg-background py-1 shadow-lg"
          style={{ left: sideContextMenu.x, top: sideContextMenu.y }}
          role="menu"
          aria-label="Side tray context menu"
          data-testid="side-tray-context-menu"
        >
          <button
            type="button"
            data-testid="side-tray-context-delete"
            disabled={sortedSides.length <= 1}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs",
              sortedSides.length <= 1
                ? "cursor-not-allowed bg-muted/50 text-muted-foreground"
                : "text-destructive hover:bg-destructive/10",
            )}
            onClick={() => {
              if (sortedSides.length <= 1) return;
              const targetIndex = sideContextMenu.sideIndex;
              closeSideContextMenu();
              void onDeleteSide(targetIndex);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete side
          </button>
        </div>
      ) : null}
    </main>
  );
}

function SortableTraySide({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const horizontalOnlyTransform = transform ? { ...transform, y: 0 } : null;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(horizontalOnlyTransform),
        transition,
      }}
      className={cn(
        "touch-none cursor-grab active:cursor-grabbing",
        isDragging ? "opacity-60" : "opacity-100",
      )}
    >
      {children}
    </div>
  );
}

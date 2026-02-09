import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "@tanstack/react-router";
import { UserButton } from "@clerk/tanstack-react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Loader2,
  PenSquare,
  Plus,
  Redo2,
  Shapes,
  Trash2,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDeckForEdit } from "@/features/decks/api/useDecksApi";
import {
  useAddSide,
  useCreateCard,
  useDeleteSide,
  useMoveCardToSection,
  useReorderCardsInSection,
  useRemoveCard,
  useSaveSide,
} from "@/features/cards/api/useCardsApi";
import {
  useCreateSection,
  useRemoveSection,
  useRenameSection,
  useReorderSections,
} from "@/features/sections/api/useSectionsApi";
import {
  useDeckAccessRequests,
  useResolveAccessRequest,
} from "@/features/access-requests/api/useAccessRequestsApi";
import { useUpdateSharing } from "@/features/sharing/api/useSharingApi";
import { ShareDeckDialog } from "@/features/sharing/ShareDeckDialog";
import { QuickEditor } from "@/features/cards/editors/QuickEditor";
import { CreativeEditor } from "@/features/cards/editors/CreativeEditor";
import { useSideHistory } from "@/features/cards/side-ir/useSideHistory";
import { asSideIR, createDefaultSideIR } from "@/features/cards/side-ir/types";
import { useAutosaveSide } from "@/features/cards/autosave/useAutosaveSide";
import { SideCardPreview } from "@/features/cards/components/SideCardPreview";

type SidebarContextMenuState = {
  x: number;
  y: number;
  sectionId: string;
  insertIndex: number;
  cardId?: string;
} | null;

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const verticalOnlyTransform = transform ? { ...transform, x: 0 } : null;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(verticalOnlyTransform),
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

function SaveStatus({
  state,
  onRetry,
}: {
  state: "idle" | "saving" | "saved" | "error";
  onRetry: () => void;
}) {
  if (state === "saving") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving...
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <Clock3 className="h-3.5 w-3.5" />
          Save failed
        </div>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Check className="h-3.5 w-3.5 text-emerald-600" />
      Saved
    </div>
  );
}

export function DeckEditorScreen({
  deckId,
  preselectedCardId,
}: {
  deckId: string;
  preselectedCardId?: string;
}) {
  const navigate = useNavigate();
  const data = useDeckForEdit(deckId);

  const updateSharing = useUpdateSharing();
  const createSection = useCreateSection();
  const renameSection = useRenameSection();
  const removeSection = useRemoveSection();
  const reorderSections = useReorderSections();
  const createCard = useCreateCard();
  const reorderCards = useReorderCardsInSection();
  const moveCardToSection = useMoveCardToSection();
  const removeCard = useRemoveCard();
  const addSide = useAddSide();
  const deleteSide = useDeleteSide();
  const saveSide = useSaveSide();

  const accessRequests = useDeckAccessRequests(deckId);
  const resolveAccessRequest = useResolveAccessRequest();

  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(preselectedCardId);
  const [activeSideIndex, setActiveSideIndex] = useState(0);
  const [editorMode, setEditorMode] = useState<"quick" | "creative">("quick");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<SidebarContextMenuState>(null);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const selectedCard = useMemo(() => {
    if (!data) return null;
    for (const section of data.sections) {
      const card = section.cards.find((entry: any) => String(entry._id) === selectedCardId);
      if (card) return card;
    }
    return null;
  }, [data, selectedCardId]);

  const currentSideDoc = useMemo(() => {
    if (!selectedCard) return null;
    return (
      selectedCard.sides.find((side: any) => side.index === activeSideIndex) ??
      selectedCard.sides[0] ??
      null
    );
  }, [selectedCard, activeSideIndex]);

  const sideHistory = useSideHistory(
    currentSideDoc ? asSideIR(currentSideDoc.sideIR) : createDefaultSideIR(),
  );

  useEffect(() => {
    if (!data) return;

    if (!selectedCardId) {
      const firstCard = data.sections[0]?.cards[0];
      if (firstCard) {
        const id = String(firstCard._id);
        setSelectedCardId(id);
        void navigate({
          to: "/app/decks/$deckId/edit/card/$cardId",
          params: { deckId, cardId: id },
          replace: true,
        });
      }
    }
  }, [data, selectedCardId, deckId, navigate]);

  useEffect(() => {
    if (!selectedCard) return;
    setEditorMode(selectedCard.lastEditedMode ?? "quick");
  }, [selectedCard]);

  useEffect(() => {
    if (!currentSideDoc) return;
    setActiveSideIndex(currentSideDoc.index);
    sideHistory.reset(asSideIR(currentSideDoc.sideIR));
  }, [currentSideDoc?._id]);

  const autosave = useAutosaveSide({
    cardId: selectedCardId ?? "",
    sideIndex: currentSideDoc?.index ?? 0,
    side: sideHistory.present,
    mode: editorMode,
    onSave: async (payload) => {
      if (!selectedCardId) return;
      await saveSide(payload as any);
    },
  });

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier) return;

      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          sideHistory.redo();
        } else {
          sideHistory.undo();
        }
      }

      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        sideHistory.redo();
      }
    };

    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [sideHistory]);

  useEffect(() => {
    if (!contextMenu) return;

    const dismiss = () => {
      setContextMenu(null);
      setShowMoveSubmenu(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismiss();
      }
    };

    window.addEventListener("click", dismiss);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("click", dismiss);
      window.removeEventListener("keydown", onEscape);
    };
  }, [contextMenu]);

  if (!data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading deck...</div>;
  }

  const sortedSides = [...(selectedCard?.sides ?? [])].sort((a: any, b: any) => a.index - b.index);
  const sectionIds = data.sections.map((section: any) => String(section._id));

  const onSectionDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = sectionIds.indexOf(String(active.id));
    const newIndex = sectionIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const ordered = arrayMove(sectionIds, oldIndex, newIndex);
    await reorderSections({
      deckId,
      orderedSectionIds: ordered,
    } as any);
  };

  const openSectionContextMenu = (
    event: ReactMouseEvent<HTMLElement>,
    sectionId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setShowMoveSubmenu(false);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      sectionId,
      insertIndex: 0,
    });
  };

  const openCardContextMenu = (
    event: ReactMouseEvent<HTMLElement>,
    sectionId: string,
    cardId: string,
    cardIndex: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setShowMoveSubmenu(false);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      sectionId,
      insertIndex: cardIndex + 1,
      cardId,
    });
  };

  const handleNewCardInSection = async (sectionId: string, insertIndex: number) => {
    setContextMenu(null);
    setShowMoveSubmenu(false);
    try {
      const newCardId = await createCard({ deckId, sectionId } as any);
      const section = data.sections.find((entry: any) => String(entry._id) === sectionId);
      if (section) {
        const existingIds = section.cards.map((card: any) => String(card._id));
        const bounded = Math.max(0, Math.min(insertIndex, existingIds.length));
        if (bounded < existingIds.length) {
          const orderedCardIds = [...existingIds];
          orderedCardIds.splice(bounded, 0, String(newCardId));
          await reorderCards({ sectionId, orderedCardIds } as any);
        }
      }

      const id = String(newCardId);
      setSelectedCardId(id);
      toast.success("Card created");
      void navigate({
        to: "/app/decks/$deckId/edit/card/$cardId",
        params: { deckId, cardId: id },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create card");
    }
  };

  const handleMoveCardToSection = async (cardId: string, sectionId: string) => {
    setContextMenu(null);
    setShowMoveSubmenu(false);
    try {
      await moveCardToSection({ cardId, sectionId } as any);
      toast.success("Card moved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move card");
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    setContextMenu(null);
    setShowMoveSubmenu(false);
    try {
      const wasSelected = selectedCardId === cardId;
      await removeCard({ cardId } as any);
      toast.success("Card deleted");
      if (wasSelected) {
        setSelectedCardId(undefined);
        void navigate({
          to: "/app/decks/$deckId/edit",
          params: { deckId },
          replace: true,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete card");
    }
  };

  const handleRenameSection = async (sectionId: string) => {
    setContextMenu(null);
    setShowMoveSubmenu(false);
    const section = data.sections.find((entry: any) => String(entry._id) === sectionId);
    if (!section) return;

    const nextTitle = window.prompt("Rename section", section.title ?? "");
    if (nextTitle === null) return;

    try {
      await renameSection({
        sectionId,
        title: nextTitle,
      } as any);
      toast.success("Section renamed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename section");
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    setContextMenu(null);
    setShowMoveSubmenu(false);
    const section = data.sections.find((entry: any) => String(entry._id) === sectionId);
    if (!section) return;

    const confirmed = window.confirm(
      `Delete section "${section.title}"? This will also delete all cards inside it.`,
    );
    if (!confirmed) return;

    const removedSelectedCard = section.cards.some((card: any) => String(card._id) === selectedCardId);

    try {
      await removeSection({ sectionId } as any);
      toast.success("Section deleted");
      if (removedSelectedCard) {
        setSelectedCardId(undefined);
        setActiveSideIndex(0);
        void navigate({
          to: "/app/decks/$deckId/edit",
          params: { deckId },
          replace: true,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete section");
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <header className="h-12 border-b border-border flex items-center justify-between px-4 flex-shrink-0 bg-background">
        <div className="flex items-center gap-2 text-sm">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            aria-label="Back to deck"
            title="Back to deck"
            onClick={() =>
              void navigate({
                to: "/deck/$deckId",
                params: { deckId },
              })
            }
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-muted-foreground">{data.deck.title}</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">Edit Card</span>
          <div className="ml-2">
            <SaveStatus state={autosave.state} onRetry={autosave.retry} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ShareDeckDialog
            deck={data.deck}
            onSave={async (payload) => {
              await updateSharing(payload as any);
              toast.success("Sharing updated");
            }}
          />
          <UserButton />
        </div>
      </header>

      <div className="deck-editor-layout flex-1 flex min-h-0 overflow-hidden">
        <aside className="deck-editor-sidebar h-full border-r border-border bg-background flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Card Position
              </h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  const sectionId = await createSection({
                    deckId,
                    title: `Section ${data.sections.length + 1}`,
                  } as any);
                  const cardId = await createCard({ deckId, sectionId } as any);
                  const id = String(cardId);
                  setSelectedCardId(id);
                  toast.success("Section created");
                  void navigate({
                    to: "/app/decks/$deckId/edit/card/$cardId",
                    params: { deckId, cardId: id },
                  });
                }}
              >
                <Plus className="h-4 w-4" /> Section
              </Button>
            </div>
          </div>

          <ScrollArea className="h-full p-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
              <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {data.sections.map((section: any) => {
                    const cardIds = section.cards.map((card: any) => String(card._id));
                    const isCollapsed = collapsedSections[String(section._id)] ?? false;
                    const isActiveSection = section.cards.some(
                      (card: any) => String(card._id) === selectedCardId,
                    );

                    return (
                      <SortableRow key={section._id} id={String(section._id)}>
                        <div className="overflow-hidden rounded-lg border border-border bg-card">
                          <div
                            className="bg-muted/90 px-2 py-1.5 backdrop-blur-sm border-b border-border"
                            onContextMenu={(event) => openSectionContextMenu(event, String(section._id))}
                          >
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={() =>
                                  setCollapsedSections((current) => ({
                                    ...current,
                                    [String(section._id)]: !isCollapsed,
                                  }))
                                }
                              >
                                {isCollapsed ? (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <p className="flex-1 truncate text-xs font-semibold tracking-wide">
                                {section.title}
                              </p>
                              {isActiveSection && (
                                <span className="rounded bg-black px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-white">
                                  active
                                </span>
                              )}
                            </div>
                            <p className="pl-7 text-[10px] text-muted-foreground">
                              {section.cards.length} card{section.cards.length === 1 ? "" : "s"}
                              {!isCollapsed ? " - drag to reorder" : ""}
                            </p>
                          </div>

                          {!isCollapsed && (
                            <div className="p-2">
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={async ({ active, over }) => {
                                  if (!over || active.id === over.id) return;
                                  const oldIndex = cardIds.indexOf(String(active.id));
                                  const newIndex = cardIds.indexOf(String(over.id));
                                  if (oldIndex < 0 || newIndex < 0) return;
                                  const ordered = arrayMove(cardIds, oldIndex, newIndex);
                                  await reorderCards({
                                    sectionId: section._id,
                                    orderedCardIds: ordered,
                                  } as any);
                                }}
                              >
                                <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
                                  <div className="space-y-2">
                                    {section.cards.map((card: any, index: number) => {
                                      const isActive = String(card._id) === selectedCardId;
                                      const frontSideDoc =
                                        card.sides?.find((entry: any) => entry.index === 0) ?? card.sides?.[0];
                                      const side = isActive
                                        ? sideHistory.present
                                        : asSideIR(frontSideDoc?.sideIR);

                                      return (
                                        <SortableRow key={card._id} id={String(card._id)}>
                                          <button
                                            type="button"
                                            data-testid={`card-sidebar-preview-${card._id}`}
                                            onContextMenu={(event) =>
                                              openCardContextMenu(
                                                event,
                                                String(section._id),
                                                String(card._id),
                                                index,
                                              )
                                            }
                                            onClick={() => {
                                              const id = String(card._id);
                                              setSelectedCardId(id);
                                              void navigate({
                                                to: "/app/decks/$deckId/edit/card/$cardId",
                                                params: { deckId, cardId: id },
                                              });
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
                            </div>
                          )}
                        </div>
                      </SortableRow>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </ScrollArea>

          {contextMenu && (
            <div
              className="fixed z-50 min-w-[170px] rounded-lg border border-border bg-background py-1 shadow-lg"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                onClick={() => handleNewCardInSection(contextMenu.sectionId, contextMenu.insertIndex)}
              >
                <Plus className="h-3.5 w-3.5" />
                New card
              </button>

              {!contextMenu.cardId && (
                <>
                  <div className="my-1 border-t border-border" />
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                    onClick={() => handleRenameSection(contextMenu.sectionId)}
                  >
                    <PenSquare className="h-3.5 w-3.5" />
                    Rename section
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteSection(contextMenu.sectionId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete section
                  </button>
                </>
              )}

              {contextMenu.cardId && (
                <>
                  <div
                    className="relative"
                    onMouseEnter={() => setShowMoveSubmenu(true)}
                    onMouseLeave={() => setShowMoveSubmenu(false)}
                  >
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent",
                        showMoveSubmenu && "bg-accent",
                      )}
                    >
                      <span>Move to Section</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    {showMoveSubmenu && (
                      <div className="absolute left-full top-0 ml-1 min-w-[130px] rounded-lg border border-border bg-background py-1 shadow-lg">
                        {data.sections.map((section: any) => {
                          const currentSectionId = contextMenu.sectionId;
                          const targetSectionId = String(section._id);
                          const isCurrent = targetSectionId === currentSectionId;
                          return (
                            <button
                              key={section._id}
                              type="button"
                              disabled={isCurrent}
                              onClick={() =>
                                contextMenu.cardId &&
                                handleMoveCardToSection(contextMenu.cardId, targetSectionId)
                              }
                              className={cn(
                                "w-full px-3 py-1.5 text-left text-xs",
                                isCurrent
                                  ? "cursor-not-allowed bg-muted/50 text-muted-foreground"
                                  : "hover:bg-accent",
                              )}
                            >
                              {section.title}
                              {isCurrent ? " (current)" : ""}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="my-1 border-t border-border" />
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => contextMenu.cardId && handleDeleteCard(contextMenu.cardId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete card
                  </button>
                </>
              )}
            </div>
          )}

        </aside>

        <main className="flex-1 min-w-0 flex flex-col overflow-hidden transition-all duration-200">
          {!selectedCard && (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a card to edit.
            </div>
          )}

          {selectedCard && (
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
                      editorMode === "quick" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      <PenSquare className="h-4 w-4" />
                      Quick Create
                    </span>
                    {editorMode === "quick" && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
                    )}
                  </button>
                  <button
                    type="button"
                    data-testid="mode-creative-button"
                    onClick={() => setEditorMode("creative")}
                    className={cn(
                      "relative px-4 py-2.5 text-sm font-medium transition-colors",
                      editorMode === "creative" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Shapes className="h-4 w-4" />
                      Creative Create
                    </span>
                    {editorMode === "creative" && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
                    )}
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

              <div className="deck-editor-shell-content min-h-0 overflow-y-auto p-3 md:p-4 lg:p-5 xl:p-6" data-testid="editor-content-row">
                {editorMode === "quick" ? (
                  <QuickEditor
                    side={sideHistory.present}
                    onApply={sideHistory.apply}
                  />
                ) : (
                  <CreativeEditor
                    side={sideHistory.present}
                    onApply={sideHistory.apply}
                  />
                )}

                {data.deck.visibility === "whitelist" && (
                  <div className="mt-4 rounded-lg border border-border bg-card p-4">
                    <h3 className="mb-2 font-semibold">Access Requests</h3>
                    {!accessRequests?.length && (
                      <p className="text-sm text-muted-foreground">No pending or historical requests.</p>
                    )}
                    {accessRequests?.map((request: any) => (
                      <div key={request._id} className="mb-2 flex items-center justify-between rounded-md border p-3 last:mb-0">
                        <div>
                          <p className="text-sm font-medium">{request.requesterEmail}</p>
                          <p className="text-xs text-muted-foreground">{request.message ?? "No message"}</p>
                          <Badge variant="outline" className="mt-1">
                            {request.status}
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={request.status === "approved"}
                            onClick={async () => {
                              await resolveAccessRequest({
                                requestId: request._id,
                                decision: "approved",
                              } as any);
                              toast.success("Request approved");
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={request.status === "rejected"}
                            onClick={async () => {
                              await resolveAccessRequest({
                                requestId: request._id,
                                decision: "rejected",
                              } as any);
                              toast.success("Request rejected");
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="deck-editor-side-tray-row border-t border-border bg-muted/20 px-3 md:px-4 py-3" data-testid="editor-side-tray-row">
                <div className="flex flex-wrap items-start gap-3 md:flex-nowrap md:items-center">
                  <div className="side-tray-scroll flex-1 overflow-x-auto" data-testid="side-tray">
                    <div className="side-tray-strip flex min-w-max items-start gap-3 pr-2">
                      {sortedSides.map((side: any) => {
                        const isActive = side.index === activeSideIndex;
                        const traySide = isActive ? sideHistory.present : asSideIR(side.sideIR);
                        return (
                          <button
                            key={side._id}
                            type="button"
                            data-testid={`side-tray-item-${side.index}`}
                            aria-pressed={isActive}
                            onClick={() => setActiveSideIndex(side.index)}
                            className={cn(
                              "side-tray-item rounded-lg border bg-background p-2 text-left transition-all",
                              isActive
                                ? "border-foreground ring-2 ring-foreground/20"
                                : "border-border hover:border-foreground/50",
                            )}
                          >
                            <SideCardPreview
                              side={traySide}
                              compact
                              className="w-full"
                              ariaHidden
                            />
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
                      onClick={async () => {
                        await addSide({ cardId: selectedCard._id } as any);
                        setActiveSideIndex(sortedSides.length);
                      }}
                    >
                      <Plus className="h-4 w-4" /> Add Side
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="side-tray-delete-side"
                      disabled={sortedSides.length <= 1}
                      onClick={async () => {
                        await deleteSide({ cardId: selectedCard._id, index: activeSideIndex } as any);
                        setActiveSideIndex((current) => Math.max(0, current - 1));
                      }}
                    >
                      <Trash2 className="h-4 w-4" /> Delete Side
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

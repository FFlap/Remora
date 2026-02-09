import { useEffect, useMemo, useState } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/tanstack-react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDeckForViewer, useUpdateDeckSharing } from "@/features/decks/api/useDecksApi";
import {
  useMyRequestStatus,
  useRequestAccess,
} from "@/features/access-requests/api/useAccessRequestsApi";
import { asSideIR, createDefaultSideIR } from "@/features/cards/side-ir/types";
import { SideCardPreview } from "@/features/cards/components/SideCardPreview";
import { ShareDeckDialog } from "@/features/sharing/ShareDeckDialog";

export function DeckViewerScreen({
  deckId,
  preselectedCardId,
}: {
  deckId: string;
  preselectedCardId?: string;
}) {
  const navigate = useNavigate();
  const data = useDeckForViewer(deckId);
  const updateSharing = useUpdateDeckSharing();
  const myRequestStatus = useMyRequestStatus(deckId);
  const requestAccess = useRequestAccess();

  const [requestMessage, setRequestMessage] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(preselectedCardId);
  const [sideIndex, setSideIndex] = useState(0);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const orderedCards = useMemo(() => {
    if (!data || data.access !== "granted") return [];

    const flattened: Array<{
      cardId: string;
      sectionId: string;
      sectionTitle: string;
      card: any;
      sectionCardIndex: number;
    }> = [];

    data.sections.forEach((section: any) => {
      section.cards.forEach((card: any, index: number) => {
        flattened.push({
          cardId: String(card._id),
          sectionId: String(section._id),
          sectionTitle: section.title,
          card,
          sectionCardIndex: index,
        });
      });
    });

    return flattened;
  }, [data]);

  const selectedCardEntry = useMemo(() => {
    if (orderedCards.length === 0) return null;
    return orderedCards.find((entry) => entry.cardId === selectedCardId) ?? orderedCards[0];
  }, [orderedCards, selectedCardId]);
  const selectedCard = selectedCardEntry?.card ?? null;

  useEffect(() => {
    setSelectedCardId(preselectedCardId);
  }, [deckId, preselectedCardId]);

  useEffect(() => {
    if (!data || data.access !== "granted") return;
    if (orderedCards.length === 0) return;

    const hasSelected = Boolean(selectedCardId && orderedCards.some((entry) => entry.cardId === selectedCardId));
    if (hasSelected) return;

    const fallbackId = orderedCards[0].cardId;
    setSelectedCardId(fallbackId);
    void navigate({
      to: "/deck/$deckId/card/$cardId",
      params: { deckId, cardId: fallbackId },
      replace: true,
    });
  }, [data, orderedCards, selectedCardId, deckId, navigate]);

  useEffect(() => {
    if (!data || data.access !== "granted") return;
    const sectionIds = new Set(data.sections.map((section: any) => String(section._id)));
    setCollapsedSections((current) => {
      const next: Record<string, boolean> = {};
      Object.keys(current).forEach((sectionId) => {
        if (sectionIds.has(sectionId)) next[sectionId] = current[sectionId];
      });
      return next;
    });
  }, [data]);

  useEffect(() => {
    if (selectedCardId) {
      setSideIndex(0);
    }
  }, [selectedCardId]);

  const sortedSides = useMemo(
    () => [...(selectedCard?.sides ?? [])].sort((a: any, b: any) => a.index - b.index),
    [selectedCard],
  );
  const sideCount = sortedSides.length;
  const selectedSide = sortedSides.find((entry: any) => entry.index === sideIndex) ?? sortedSides[0];
  const selectedSideIR = asSideIR(selectedSide?.sideIR);
  const activeSidePosition = Math.max(
    0,
    sortedSides.findIndex((entry: any) => entry.index === selectedSide?.index),
  );

  const orderedCardIndex = selectedCardEntry
    ? orderedCards.findIndex((entry) => entry.cardId === selectedCardEntry.cardId)
    : -1;
  const prevCard = orderedCardIndex > 0 ? orderedCards[orderedCardIndex - 1] : null;
  const nextCard = orderedCardIndex >= 0 && orderedCardIndex < orderedCards.length - 1
    ? orderedCards[orderedCardIndex + 1]
    : null;

  function goToCard(cardId: string) {
    setSelectedCardId(cardId);
    void navigate({
      to: "/deck/$deckId/card/$cardId",
      params: { deckId, cardId },
    });
  }

  function advanceSide() {
    if (sideCount === 0) return;
    if (sideCount === 2) {
      const firstIndex = sortedSides[0].index;
      const secondIndex = sortedSides[1].index;
      setSideIndex((current) => (current === secondIndex ? firstIndex : secondIndex));
      return;
    }
    setSideIndex((current) => {
      const currentPosition = sortedSides.findIndex((entry: any) => entry.index === current);
      const nextPosition = (currentPosition + 1) % sortedSides.length;
      return sortedSides[nextPosition].index;
    });
  }

  if (!data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading deck...</div>;
  }

  if (data.access !== "granted") {
    const status = myRequestStatus?.status;

    return (
      <div className="mx-auto mt-20 max-w-xl px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> {data.deck.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {data.deck.description || "This deck has restricted access."}
            </p>

            {data.access === "private" && (
              <Badge variant="outline">Private deck: owner access only</Badge>
            )}

            {data.access === "whitelist_sign_in_required" && (
              <>
                <p className="text-sm">Sign in to request access.</p>
                <SignInButton mode="modal">
                  <Button>
                    <ShieldCheck className="h-4 w-4" /> Sign In
                  </Button>
                </SignInButton>
              </>
            )}

            {(data.access === "whitelist_requestable" || status === "rejected") && (
              <SignedIn>
                <div className="space-y-2">
                  <Textarea
                    value={requestMessage}
                    onChange={(event) => setRequestMessage(event.target.value)}
                    placeholder="Optional message to deck owner"
                  />
                  <Button
                    onClick={async () => {
                      await requestAccess({
                        deckId,
                        message: requestMessage,
                      } as any);
                      toast.success("Access requested");
                    }}
                  >
                    Request access
                  </Button>
                </div>
              </SignedIn>
            )}

            {(data.access === "whitelist_pending" || status === "pending") && (
              <Badge>Request pending</Badge>
            )}

            <SignedOut>
              <p className="text-xs text-muted-foreground">Not signed in.</p>
            </SignedOut>
          </CardContent>
        </Card>
      </div>
    );
  }

  const frontSide = sortedSides[0] ? asSideIR(sortedSides[0].sideIR) : createDefaultSideIR("viewer-front");
  const backSide = sortedSides[1] ? asSideIR(sortedSides[1].sideIR) : createDefaultSideIR("viewer-back");
  const flipRatio = frontSide.layout.quickLayout.cardRatio > 0 ? frontSide.layout.quickLayout.cardRatio : 1.5;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <header className="h-12 border-b border-border flex items-center justify-between px-4 flex-shrink-0 bg-background">
        <div className="flex items-center gap-2 text-sm min-w-0">
          {data.viewer.isOwner && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              aria-label="Back to decks"
              title="Back to decks"
              onClick={() =>
                void navigate({
                  to: "/app/decks",
                })
              }
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          <span className="truncate text-muted-foreground">{data.deck.title}</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">View Deck</span>
        </div>
        {data.viewer.isOwner && (
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
        )}
      </header>

      <div className="deck-viewer-shell flex-1 min-h-0">
        <aside className="deck-viewer-sidebar" data-testid="viewer-sidebar">
        <div className="deck-viewer-sidebar-header">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Card Position</h3>
        </div>

        <div className="deck-viewer-sidebar-scroll overflow-y-auto overflow-x-hidden">
          <div className="space-y-2">
            {data.sections.map((section: any) => {
              const sectionId = String(section._id);
              const isCollapsed = collapsedSections[sectionId] ?? false;
              const isActiveSection = section.cards.some(
                (card: any) => String(card._id) === selectedCardEntry?.cardId,
              );

              return (
                <section
                  key={sectionId}
                  data-testid={`viewer-section-${sectionId}`}
                  className="overflow-hidden rounded-lg border border-border bg-card"
                >
                  <div className="border-b border-border bg-muted/90 px-2 py-1.5 backdrop-blur-sm">
                    <button
                      type="button"
                      className="flex w-full items-center gap-1 text-left"
                      onClick={() =>
                        setCollapsedSections((current) => ({
                          ...current,
                          [sectionId]: !isCollapsed,
                        }))}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="flex-1 truncate text-xs font-semibold tracking-wide">{section.title}</span>
                      {isActiveSection && (
                        <span className="rounded bg-black px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-white">
                          active
                        </span>
                      )}
                    </button>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] leading-4 text-muted-foreground">
                      <span className="inline-block h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>
                        {section.cards.length} card{section.cards.length === 1 ? "" : "s"}
                      </span>
                    </p>
                  </div>

                  {!isCollapsed && (
                    <div className="space-y-2 p-2">
                      {section.cards.map((card: any, index: number) => {
                        const cardId = String(card._id);
                        const isActive = cardId === selectedCardEntry?.cardId;
                        const front = card.sides?.find((entry: any) => entry.index === 0) ?? card.sides?.[0];
                        return (
                          <button
                            key={cardId}
                            type="button"
                            data-testid={`viewer-card-item-${cardId}`}
                            onClick={() => goToCard(cardId)}
                            className={cn(
                              "relative w-full rounded-lg p-1 text-left transition-all",
                              isActive ? "opacity-100" : "opacity-80 hover:opacity-100",
                            )}
                          >
                            <span className="pointer-events-none absolute left-3 top-3 z-20 rounded bg-black/85 px-2 py-1 text-[11px] font-semibold leading-none text-white shadow-sm">
                              {index + 1}
                            </span>
                            <SideCardPreview
                              side={asSideIR(front?.sideIR)}
                              compact
                              className={cn(
                                "w-full transition-all",
                                isActive
                                  ? "border-foreground ring-2 ring-foreground/25"
                                  : "border-border hover:border-foreground/45",
                              )}
                              ariaHidden
                            />
                            <span className="sr-only">
                              Card {index + 1} in {section.title}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
        </aside>

        <main className="deck-viewer-main">
          <div className="deck-viewer-main-scroll">
            {!selectedCard && (
              <p className="text-sm text-muted-foreground">No cards available in this deck.</p>
            )}

            {selectedCard && (
              <div className="deck-viewer-stage">
                <div className="deck-viewer-top-row">
                  {data.viewer.isOwner && (
                    <Link
                      to="/app/decks/$deckId/edit/card/$cardId"
                      params={{ deckId, cardId: selectedCardEntry?.cardId ?? String(selectedCard._id) }}
                    >
                      <Button variant="outline" size="sm">
                        Edit Deck <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>

                <button
                  type="button"
                  data-testid="viewer-main-card"
                  onClick={advanceSide}
                  className="deck-viewer-main-card-button"
                >
                  {sideCount === 2 ? (
                    <div
                      className="deck-viewer-flip-shell"
                      data-testid="viewer-main-card-flip-shell"
                      style={{ aspectRatio: String(flipRatio) }}
                    >
                      <div className={cn("deck-viewer-flip-inner", sideIndex === sortedSides[1].index && "is-flipped")}>
                        <div className="deck-viewer-flip-face deck-viewer-flip-face-front" data-testid="viewer-main-card-face-front">
                          <SideCardPreview side={frontSide} className="h-full w-full" />
                        </div>
                        <div className="deck-viewer-flip-face deck-viewer-flip-face-back" data-testid="viewer-main-card-face-back">
                          <SideCardPreview side={backSide} className="h-full w-full" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <SideCardPreview
                      side={selectedSideIR}
                      className="deck-viewer-main-card"
                      dataTestId="viewer-main-card-face-front"
                      key={selectedSide?.index ?? "empty-side"}
                    />
                  )}
                </button>
                <div className="deck-viewer-side-dots" data-testid="viewer-side-dots" aria-label="Card sides">
                  {sortedSides.map((entry: any, index: number) => (
                    <button
                      key={entry._id ?? `side-dot-${entry.index}`}
                      type="button"
                      data-testid={`viewer-side-dot-${index}`}
                      className={cn(
                        "deck-viewer-side-dot",
                        index === activeSidePosition ? "is-active" : "is-inactive",
                      )}
                      onClick={() => setSideIndex(entry.index)}
                      aria-label={`Go to side ${index + 1}`}
                      aria-pressed={index === activeSidePosition}
                    />
                  ))}
                </div>

                <div className="deck-viewer-nav-row">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    data-testid="viewer-prev-card"
                    className="deck-viewer-nav-button"
                    onClick={() => prevCard && goToCard(prevCard.cardId)}
                    disabled={!prevCard}
                    aria-label="Previous card"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <p data-testid="viewer-card-counter" className="deck-viewer-nav-count">
                    {orderedCardIndex + 1} / {orderedCards.length}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    data-testid="viewer-next-card"
                    className="deck-viewer-nav-button"
                    onClick={() => nextCard && goToCard(nextCard.cardId)}
                    disabled={!nextCard}
                    aria-label="Next card"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  {sideCount === 2 ? "Click card to flip." : "Click card to advance to next side."}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

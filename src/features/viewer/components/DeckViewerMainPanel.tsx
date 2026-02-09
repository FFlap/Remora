import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SideCardPreview } from "@/features/cards/components/SideCardPreview";
import { asSideIR, createDefaultSideIR } from "@/features/cards/side-ir/types";
import type { ViewerCard, ViewerSide } from "@/features/viewer/hooks/viewerTypes";
import { cn } from "@/lib/utils";

type DeckViewerMainPanelProps = {
  isOwner: boolean;
  deckId: string;
  selectedCard: ViewerCard | null;
  selectedCardRouteId?: string;
  sideIndex: number;
  sideCount: number;
  sortedSides: ViewerSide[];
  selectedSideIR: ReturnType<typeof asSideIR>;
  selectedSideKey?: number;
  activeSidePosition: number;
  orderedCardIndex: number;
  orderedCardsLength: number;
  prevCardId?: string;
  nextCardId?: string;
  onAdvanceSide: () => void;
  onSelectSide: (sideIndex: number) => void;
  onGoToCard: (cardId: string) => void;
};

export function DeckViewerMainPanel({
  isOwner,
  deckId,
  selectedCard,
  selectedCardRouteId,
  sideIndex,
  sideCount,
  sortedSides,
  selectedSideIR,
  selectedSideKey,
  activeSidePosition,
  orderedCardIndex,
  orderedCardsLength,
  prevCardId,
  nextCardId,
  onAdvanceSide,
  onSelectSide,
  onGoToCard,
}: DeckViewerMainPanelProps) {
  const frontSide = sortedSides[0]
    ? asSideIR(sortedSides[0].sideIR)
    : createDefaultSideIR("viewer-front");
  const backSide = sortedSides[1]
    ? asSideIR(sortedSides[1].sideIR)
    : createDefaultSideIR("viewer-back");
  const flipRatio =
    frontSide.layout.quickLayout.cardRatio > 0
      ? frontSide.layout.quickLayout.cardRatio
      : 1.5;

  return (
    <main className="deck-viewer-main">
      <div className="deck-viewer-main-scroll">
        {!selectedCard && (
          <p className="text-sm text-muted-foreground">No cards available in this deck.</p>
        )}

        {selectedCard !== null && (
          <div className="deck-viewer-stage">
            <div className="deck-viewer-top-row">
              {isOwner ? (
                <Link
                  to="/app/decks/$deckId/edit/card/$cardId"
                  params={{
                    deckId,
                    cardId: selectedCardRouteId ?? String(selectedCard._id),
                  }}
                >
                  <Button variant="outline" size="sm">
                    Edit Deck <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : null}
            </div>

            <button
              type="button"
              data-testid="viewer-main-card"
              onClick={onAdvanceSide}
              className="deck-viewer-main-card-button"
            >
              {sideCount === 2 ? (
                <div
                  className="deck-viewer-flip-shell"
                  data-testid="viewer-main-card-flip-shell"
                  style={{ aspectRatio: String(flipRatio) }}
                >
                  <div
                    className={cn(
                      "deck-viewer-flip-inner",
                      sideIndex === sortedSides[1]?.index && "is-flipped",
                    )}
                  >
                    <div
                      className="deck-viewer-flip-face deck-viewer-flip-face-front"
                      data-testid="viewer-main-card-face-front"
                    >
                      <SideCardPreview side={frontSide} className="h-full w-full" />
                    </div>
                    <div
                      className="deck-viewer-flip-face deck-viewer-flip-face-back"
                      data-testid="viewer-main-card-face-back"
                    >
                      <SideCardPreview side={backSide} className="h-full w-full" />
                    </div>
                  </div>
                </div>
              ) : (
                <SideCardPreview
                  side={selectedSideIR}
                  className="deck-viewer-main-card"
                  dataTestId="viewer-main-card-face-front"
                  key={selectedSideKey ?? "empty-side"}
                />
              )}
            </button>
            <div className="deck-viewer-side-dots" data-testid="viewer-side-dots">
              {sortedSides.map((entry, index) => (
                <button
                  key={entry._id ?? `side-dot-${entry.index}`}
                  type="button"
                  data-testid={`viewer-side-dot-${index}`}
                  className={cn(
                    "deck-viewer-side-dot",
                    index === activeSidePosition ? "is-active" : "is-inactive",
                  )}
                  onClick={() => onSelectSide(entry.index)}
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
                onClick={() => prevCardId && onGoToCard(prevCardId)}
                disabled={!prevCardId}
                aria-label="Previous card"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <p data-testid="viewer-card-counter" className="deck-viewer-nav-count">
                {orderedCardIndex + 1} / {orderedCardsLength}
              </p>
              <Button
                type="button"
                variant="outline"
                size="icon"
                data-testid="viewer-next-card"
                className="deck-viewer-nav-button"
                onClick={() => nextCardId && onGoToCard(nextCardId)}
                disabled={!nextCardId}
                aria-label="Next card"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {sideCount === 2
                ? "Click card to flip."
                : "Click card to advance to next side."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

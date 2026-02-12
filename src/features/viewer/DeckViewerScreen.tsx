import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import {
  useMyRequestStatus,
  useRequestAccess,
} from "@/features/access-requests/api/useAccessRequestsApi";
import { useDeckForViewer, useUpdateDeckSharing } from "@/features/decks/api/useDecksApi";
import { DeckViewerAccessGate } from "@/features/viewer/components/DeckViewerAccessGate";
import { DeckViewerHeader } from "@/features/viewer/components/DeckViewerHeader";
import { DeckViewerMainPanel } from "@/features/viewer/components/DeckViewerMainPanel";
import { DeckViewerSidebar } from "@/features/viewer/components/DeckViewerSidebar";
import { useDeckViewerState } from "@/features/viewer/hooks/useDeckViewerState";
import type { ViewerSection } from "@/features/viewer/hooks/viewerTypes";
import type { Id } from "@/lib/convexApi";

type DeckSharingPayload = {
  deckId: string;
  visibility: "public" | "unlisted" | "private" | "whitelist";
  whitelistEmails: string[];
};

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
  const requestAccess = useRequestAccess();

  const shouldLoadRequestStatus =
    data !== undefined && data.access !== "granted" && data.access !== "private";
  const myRequestStatus = useMyRequestStatus(shouldLoadRequestStatus ? deckId : undefined);

  const viewerSections =
    (data?.access === "granted" ? (data.sections as ViewerSection[]) : []) ?? [];

  const navigateToCard = useCallback(
    (cardId: string, replace = false) => {
      void navigate({
        to: "/deck/$deckId/card/$cardId",
        params: { deckId, cardId },
        replace,
      });
    },
    [deckId, navigate],
  );

  const backToDecks = useCallback(() => {
    void navigate({
      to: "/app/decks",
    });
  }, [navigate]);

  const saveSharing = useCallback(
    async (payload: DeckSharingPayload) => {
      await updateSharing({
        ...payload,
        deckId: payload.deckId as Id<"decks">,
      });
      toast.success("Sharing updated");
    },
    [updateSharing],
  );

  const viewerState = useDeckViewerState({
    preselectedCardId,
    sections: viewerSections,
    onNavigateToCard: navigateToCard,
  });

  if (!data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading deck...</div>;
  }

  if (data.access !== "granted") {
    return (
      <DeckViewerAccessGate
        data={data}
        deckId={deckId}
        requestStatus={myRequestStatus?.status}
        requestAccess={requestAccess}
      />
    );
  }

  const isOwner = Boolean(data.viewer.isOwner);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <DeckViewerHeader
        deck={data.deck}
        isOwner={isOwner}
        onBackToDecks={backToDecks}
        onSaveSharing={saveSharing}
      />

      <div className="deck-viewer-shell flex-1 min-h-0">
        <DeckViewerSidebar
          sections={viewerSections}
          collapsedSections={viewerState.collapsedSections}
          selectedCardId={viewerState.selectedCardEntry?.cardId}
          onToggleSection={viewerState.toggleSection}
          onSelectCard={viewerState.goToCard}
        />

        <DeckViewerMainPanel
          isOwner={isOwner}
          deckId={deckId}
          selectedCard={viewerState.selectedCard}
          selectedCardRouteId={viewerState.selectedCardEntry?.cardId}
          sideIndex={viewerState.sideIndex}
          sideCount={viewerState.sideCount}
          sortedSides={viewerState.sortedSides}
          selectedSideModel={viewerState.selectedSideModel}
          selectedSideKey={viewerState.selectedSide?.index}
          activeSidePosition={viewerState.activeSidePosition}
          orderedCardIndex={viewerState.orderedCardIndex}
          orderedCardsLength={viewerState.orderedCards.length}
          prevCardId={viewerState.prevCard?.cardId}
          nextCardId={viewerState.nextCard?.cardId}
          onAdvanceSide={viewerState.advanceSide}
          onSelectSide={viewerState.setSideIndex}
          onGoToCard={viewerState.goToCard}
        />
      </div>
    </div>
  );
}

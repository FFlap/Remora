import { createFileRoute } from "@tanstack/react-router";
import { DeckViewerScreen } from "@/features/viewer/DeckViewerScreen";

export const Route = createFileRoute("/deck/$deckId/card/$cardId")({
  component: DeckViewerCardRoute,
});

function DeckViewerCardRoute() {
  const { deckId, cardId } = Route.useParams();
  return <DeckViewerScreen deckId={deckId} preselectedCardId={cardId} />;
}

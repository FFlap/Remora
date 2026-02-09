import { createFileRoute } from "@tanstack/react-router";
import { DeckViewerScreen } from "@/features/viewer/DeckViewerScreen";

export const Route = createFileRoute("/deck/$deckId/")({
  component: DeckViewerRoute,
});

function DeckViewerRoute() {
  const { deckId } = Route.useParams();
  return <DeckViewerScreen deckId={deckId} />;
}

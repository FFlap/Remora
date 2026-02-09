import { createFileRoute } from "@tanstack/react-router";
import { DeckEditorScreen } from "@/features/decks/components/DeckEditorScreen";

export const Route = createFileRoute("/app/decks/$deckId/edit")({
  component: DeckEditRoute,
});

function DeckEditRoute() {
  const { deckId } = Route.useParams();
  return <DeckEditorScreen deckId={deckId} />;
}

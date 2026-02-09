import { createFileRoute } from "@tanstack/react-router";
import { DeckEditorScreen } from "@/features/decks/components/DeckEditorScreen";

export const Route = createFileRoute("/app/decks/$deckId/edit/card/$cardId")({
  component: DeckEditCardRoute,
});

function DeckEditCardRoute() {
  const { deckId, cardId } = Route.useParams();
  return <DeckEditorScreen deckId={deckId} preselectedCardId={cardId} />;
}

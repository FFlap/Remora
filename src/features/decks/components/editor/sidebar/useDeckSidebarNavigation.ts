import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

export function useDeckSidebarNavigation({
  deckId,
  onSelectCard,
  onResetActiveSideIndex,
}: {
  deckId: string;
  onSelectCard: (cardId: string | undefined) => void;
  onResetActiveSideIndex: () => void;
}) {
  const navigate = useNavigate();

  const selectCard = useCallback(
    (cardId: string) => {
      onResetActiveSideIndex();
      onSelectCard(cardId);
      void navigate({
        to: "/app/decks/$deckId/edit/card/$cardId",
        params: { deckId, cardId },
      });
    },
    [deckId, navigate, onResetActiveSideIndex, onSelectCard],
  );

  const clearSelection = useCallback(() => {
    onSelectCard(undefined);
    onResetActiveSideIndex();
    void navigate({
      to: "/app/decks/$deckId/edit",
      params: { deckId },
      replace: true,
    });
  }, [deckId, navigate, onResetActiveSideIndex, onSelectCard]);

  return {
    selectCard,
    clearSelection,
  };
}

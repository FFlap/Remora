import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

export function useDeckSidebarNavigation({
  deckId,
  onBeforeSelectCard,
  onSelectCard,
  onResetActiveSideIndex,
}: {
  deckId: string;
  onBeforeSelectCard?: () => Promise<void>;
  onSelectCard: (cardId: string | undefined) => void | Promise<void>;
  onResetActiveSideIndex: () => void;
}) {
  const navigate = useNavigate();

  const selectCard = useCallback(
    async (cardId: string) => {
      if (onBeforeSelectCard) {
        try {
          await onBeforeSelectCard();
        } catch {
          // Ignore autosave flush failures here and still allow navigation.
        }
      }
      onResetActiveSideIndex();
      await onSelectCard(cardId);
      await navigate({
        to: "/app/decks/$deckId/edit/card/$cardId",
        params: { deckId, cardId },
      });
    },
    [deckId, navigate, onBeforeSelectCard, onResetActiveSideIndex, onSelectCard],
  );

  const clearSelection = useCallback(() => {
    void onSelectCard(undefined);
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

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  useDeleteDeck,
  useMyDecks,
  useUpdateDeckMeta,
  useUpdateDeckSharing,
} from "@/features/decks/api/useDecksApi";
import { DeckListGrid } from "@/features/decks/components/list/DeckListGrid";
import { DeckListHeader } from "@/features/decks/components/list/DeckListHeader";
import { DeckSettingsDialog } from "@/features/decks/components/list/DeckSettingsDialog";
import {
  type DeckListItem,
  useDeckSettingsDialog,
} from "@/features/decks/hooks/useDeckSettingsDialog";

export const Route = createFileRoute("/app/decks/")({
  component: DeckListPage,
});

function DeckListPage() {
  const navigate = useNavigate();
  const decks = useMyDecks() ?? [];
  const updateDeckMeta = useUpdateDeckMeta();
  const updateDeckSharing = useUpdateDeckSharing();
  const deleteDeck = useDeleteDeck();
  const [deletingDeckId, setDeletingDeckId] = useState<string | null>(null);

  const settingsDialog = useDeckSettingsDialog({
    updateDeckMeta,
    updateDeckSharing,
  });

  const openDeck = (deckId: string) => {
    void navigate({
      to: "/deck/$deckId",
      params: { deckId },
    });
  };

  const handleDeleteDeck = async (deck: DeckListItem) => {
    if (!window.confirm(`Delete "${deck.title}"? This cannot be undone.`)) {
      return;
    }

    const deckId = String(deck._id);
    setDeletingDeckId(deckId);
    try {
      await deleteDeck({ deckId: deck._id });
      toast.success("Deck deleted");
      if (settingsDialog.deckInSettings?._id === deck._id) {
        settingsDialog.resetDialog();
      }
    } catch {
      toast.error("Failed to delete deck");
    } finally {
      setDeletingDeckId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <DeckListHeader />

      <DeckListGrid
        decks={decks}
        deletingDeckId={deletingDeckId}
        onOpenDeck={openDeck}
        onOpenSettings={settingsDialog.openSettings}
        onDeleteDeck={handleDeleteDeck}
      />

      <DeckSettingsDialog
        open={settingsDialog.isSettingsOpen}
        title={settingsDialog.title}
        description={settingsDialog.description}
        visibility={settingsDialog.visibility}
        savingSettings={settingsDialog.savingSettings}
        titleRef={settingsDialog.titleRef}
        descriptionRef={settingsDialog.descriptionRef}
        visibilityRef={settingsDialog.visibilityRef}
        onOpenChange={settingsDialog.handleOpenChange}
        onTitleChange={settingsDialog.setTitle}
        onDescriptionChange={settingsDialog.setDescription}
        onVisibilityChange={settingsDialog.setVisibility}
        onCancel={() => settingsDialog.handleOpenChange(false)}
        onSave={settingsDialog.saveSettings}
      />
    </div>
  );
}

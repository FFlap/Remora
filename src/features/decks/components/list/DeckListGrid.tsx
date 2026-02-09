import { DeckListCard } from "@/features/decks/components/list/DeckListCard";
import type {
  DeckListItem,
  DeckSettingsFocusField,
} from "@/features/decks/hooks/useDeckSettingsDialog";

type DeckListGridProps = {
  decks: DeckListItem[];
  deletingDeckId: string | null;
  onOpenDeck: (deckId: string) => void;
  onOpenSettings: (deck: DeckListItem, focus: DeckSettingsFocusField) => void;
  onDeleteDeck: (deck: DeckListItem) => Promise<void>;
};

export function DeckListGrid({
  decks,
  deletingDeckId,
  onOpenDeck,
  onOpenSettings,
  onDeleteDeck,
}: DeckListGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {decks.map((deck) => (
        <DeckListCard
          key={deck._id}
          deck={deck}
          isDeleting={deletingDeckId === String(deck._id)}
          onOpenDeck={onOpenDeck}
          onEditDetails={() => onOpenSettings(deck, "title")}
          onDeleteDeck={() => {
            void onDeleteDeck(deck);
          }}
        />
      ))}
    </div>
  );
}

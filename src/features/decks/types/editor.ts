import type { Doc } from "@/lib/convexApi";

export type DeckEditShellCard = Doc<"cards"> & {
  frontSide: Doc<"cardSides"> | null;
};

export type DeckEditShellSection = Doc<"sections"> & {
  cards: DeckEditShellCard[];
};

export type DeckSidebarVisibleCard = {
  card: DeckEditShellCard;
  originalIndex: number;
};

export type DeckSidebarVisibleSection = {
  section: DeckEditShellSection;
  visibleCards: DeckSidebarVisibleCard[];
};

export type DeckEditShellData = {
  deck: Doc<"decks">;
  sections: DeckEditShellSection[];
  viewer: {
    isOwner: true;
    user: Doc<"users">;
  };
};

export type DeckEditorCardData = {
  card: Doc<"cards">;
  sides: Doc<"cardSides">[];
} | null;

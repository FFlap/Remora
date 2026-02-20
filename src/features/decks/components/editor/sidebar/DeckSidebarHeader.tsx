import { CardSearchInput } from "@/features/cards/components/CardSearchInput";

type DeckSidebarHeaderProps = {
  searchValue: string;
  onSearchChange: (nextValue: string) => void;
};

export function DeckSidebarHeader({ searchValue, onSearchChange }: DeckSidebarHeaderProps) {
  return (
    <div className="p-3 border-b border-border flex-shrink-0">
      <CardSearchInput
        value={searchValue}
        onChange={onSearchChange}
        dataTestId="deck-sidebar-search-input"
      />
    </div>
  );
}

import { UserButton } from "@clerk/tanstack-react-start";
import { ArrowLeft } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { ShareDeckDialog } from "@/features/sharing/ShareDeckDialog";
import type { ViewerGrantedData } from "@/features/viewer/hooks/viewerTypes";

type ShareDeckPayload = Parameters<
  NonNullable<ComponentProps<typeof ShareDeckDialog>["onSave"]>
>[0];

type DeckViewerHeaderProps = {
  deck: ViewerGrantedData["deck"];
  isOwner: boolean;
  onBackToDecks: () => void;
  onSaveSharing: (payload: ShareDeckPayload) => Promise<void>;
};

export function DeckViewerHeader({
  deck,
  isOwner,
  onBackToDecks,
  onSaveSharing,
}: DeckViewerHeaderProps) {
  return (
    <header className="h-12 border-b border-border flex items-center justify-between px-4 flex-shrink-0 bg-background">
      <div className="flex items-center gap-2 text-sm min-w-0">
        {isOwner ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            aria-label="Back to decks"
            title="Back to decks"
            onClick={onBackToDecks}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        <span className="truncate text-muted-foreground">{deck.title}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="font-medium text-foreground">View Deck</span>
      </div>
      {isOwner ? (
        <div className="flex items-center gap-2">
          <ShareDeckDialog deck={deck} onSave={onSaveSharing} />
          <UserButton />
        </div>
      ) : null}
    </header>
  );
}

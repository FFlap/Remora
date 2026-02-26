import { MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DeckListItem } from "@/features/decks/hooks/useDeckSettingsDialog";

type DeckListCardProps = {
  deck: DeckListItem;
  isDeleting: boolean;
  onOpenDeck: (deckId: string) => void;
  onEditDetails: () => void;
  onDeleteDeck: () => void;
};

export function DeckListCard({
  deck,
  isDeleting,
  onOpenDeck,
  onEditDetails,
  onDeleteDeck,
}: DeckListCardProps) {
  const deckId = String(deck._id);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpenDeck(deckId)}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDeck(deckId);
        }
      }}
      className="cursor-pointer transition-colors hover:border-foreground/30 hover:bg-accent/20"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="break-words pr-1 leading-snug">{deck.title}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-md"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Deck options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(event) => event.stopPropagation()}
              className="w-52"
            >
              <DropdownMenuItem onSelect={onEditDetails}>Edit deck details</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={isDeleting}
                onSelect={() => {
                  if (isDeleting) return;
                  onDeleteDeck();
                }}
                className="text-destructive hover:text-destructive"
              >
                {isDeleting ? "Deleting..." : "Delete deck"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
          {deck.description || "No description"}
        </p>
        <Badge variant="outline">{deck.visibility}</Badge>
      </CardContent>
    </Card>
  );
}

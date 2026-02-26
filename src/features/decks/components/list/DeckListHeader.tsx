import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeckListHeader() {
  return (
    <div className="mb-6 flex items-center justify-between gap-2">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Your Decks</h1>
        <p className="text-sm text-muted-foreground">Create, edit, and share flashcard decks.</p>
      </div>

      <Link to="/app/decks/new">
        <Button>
          <Plus className="h-4 w-4" /> New Deck
        </Button>
      </Link>
    </div>
  );
}

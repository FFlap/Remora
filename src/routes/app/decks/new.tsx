import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateDeck } from "@/features/decks/api/useDecksApi";

export const Route = createFileRoute("/app/decks/new")({
  component: NewDeckPage,
});

function NewDeckPage() {
  const navigate = useNavigate();
  const createDeck = useCreateDeck();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Deck</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div data-testid="newdeck-hydrated" className="hidden">
            {hydrated ? "yes" : "no"}
          </div>
          <div className="space-y-2">
            <label htmlFor="new-deck-title" className="text-sm font-medium">Title</label>
            <Input
              id="new-deck-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Biology Midterm"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="new-deck-description" className="text-sm font-medium">Description</label>
            <Textarea
              id="new-deck-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Cells, mitosis, and genetics"
            />
          </div>

          <Button
            disabled={saving || !title.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                const result = await createDeck({
                  title,
                  description,
                });
                toast.success("Deck created");
                void navigate({
                  to: "/app/decks/$deckId/edit/card/$cardId",
                  params: {
                    deckId: String(result.deckId),
                    cardId: String(result.cardId),
                  },
                });
              } catch {
                toast.error("Failed to create deck");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Creating..." : "Create Deck"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

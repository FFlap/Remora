import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MoreVertical, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useDeleteDeck,
  useMyDecks,
  useUpdateDeckMeta,
  useUpdateDeckSharing,
} from "@/features/decks/api/useDecksApi";
import type { Doc } from "@/lib/convexApi";

export const Route = createFileRoute("/app/decks/")({
  component: DeckListPage,
});

type DeckListItem = Doc<"decks">;

function DeckListPage() {
  const navigate = useNavigate();
  const decks = useMyDecks() ?? [];
  const updateDeckMeta = useUpdateDeckMeta();
  const updateDeckSharing = useUpdateDeckSharing();
  const deleteDeck = useDeleteDeck();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deckInSettings, setDeckInSettings] = useState<DeckListItem | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<
    "public" | "unlisted" | "private" | "whitelist"
  >("private");
  const [savingSettings, setSavingSettings] = useState(false);
  const [deletingDeckId, setDeletingDeckId] = useState<string | null>(null);
  const [focusField, setFocusField] = useState<"title" | "description" | "visibility" | null>(
    null,
  );

  const titleRef = useRef<HTMLInputElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const visibilityRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    if (!isSettingsOpen || !focusField) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (focusField === "title") {
        titleRef.current?.focus();
        titleRef.current?.select();
      } else if (focusField === "description") {
        descriptionRef.current?.focus();
      } else {
        visibilityRef.current?.focus();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [focusField, isSettingsOpen]);

  const openSettings = (deck: DeckListItem, initialFocus: "title" | "description" | "visibility") => {
    setDeckInSettings(deck);
    setTitle(deck.title ?? "");
    setDescription(deck.description ?? "");
    setVisibility((deck.visibility ?? "private") as "public" | "unlisted" | "private" | "whitelist");
    setFocusField(initialFocus);
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = async () => {
    if (!deckInSettings) {
      return;
    }
    const nextTitle = title.trim();
    if (!nextTitle) {
      toast.error("Deck title is required");
      return;
    }

    setSavingSettings(true);
    try {
      await updateDeckMeta({
        deckId: deckInSettings._id,
        title: nextTitle,
        description,
      });

      await updateDeckSharing({
        deckId: deckInSettings._id,
        visibility,
        whitelistEmails: deckInSettings.whitelistEmails ?? [],
      });

      toast.success("Deck settings saved");
      setIsSettingsOpen(false);
      setDeckInSettings(null);
      setFocusField(null);
    } catch {
      toast.error("Failed to save deck settings");
    } finally {
      setSavingSettings(false);
    }
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
      if (deckInSettings?._id === deck._id) {
        setIsSettingsOpen(false);
        setDeckInSettings(null);
        setFocusField(null);
      }
    } catch {
      toast.error("Failed to delete deck");
    } finally {
      setDeletingDeckId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {decks.map((deck) => (
          <Card
            key={deck._id}
            role="button"
            tabIndex={0}
            onClick={() =>
              void navigate({
                to: "/deck/$deckId",
                params: { deckId: String(deck._id) },
              })
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void navigate({
                  to: "/deck/$deckId",
                  params: { deckId: String(deck._id) },
                });
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
                    <DropdownMenuItem onSelect={() => openSettings(deck, "title")}>
                      Edit deck details
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => {
                        void handleDeleteDeck(deck);
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      {deletingDeckId === String(deck._id) ? "Deleting..." : "Delete deck"}
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
        ))}
      </div>

      <Dialog
        open={isSettingsOpen}
        onOpenChange={(open) => {
          setIsSettingsOpen(open);
          if (!open) {
            setFocusField(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deck settings</DialogTitle>
            <DialogDescription>Update name, description, and share status.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="deck-settings-title" className="text-sm font-medium">Deck name</label>
              <Input
                id="deck-settings-title"
                ref={titleRef}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Deck title"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="deck-settings-description" className="text-sm font-medium">Description</label>
              <Textarea
                id="deck-settings-description"
                ref={descriptionRef}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What this deck is about"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="deck-settings-visibility" className="text-sm font-medium">Share status</label>
              <select
                id="deck-settings-visibility"
                ref={visibilityRef}
                value={visibility}
                onChange={(event) =>
                  setVisibility(
                    event.target.value as "public" | "unlisted" | "private" | "whitelist",
                  )
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
                <option value="whitelist">Whitelist</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)} disabled={savingSettings}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveSettings()} disabled={savingSettings || !title.trim()}>
              {savingSettings ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

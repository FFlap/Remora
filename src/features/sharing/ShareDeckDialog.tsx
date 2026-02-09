import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { Doc } from "@/lib/convexApi";

const visibilityOptions = ["public", "unlisted", "private", "whitelist"] as const;

type DeckDoc = Doc<"decks">;

export function ShareDeckDialog({
  deck,
  onSave,
  triggerLabel = "Share",
}: {
  deck: DeckDoc;
  onSave: (payload: {
    deckId: string;
    visibility: "public" | "unlisted" | "private" | "whitelist";
    whitelistEmails: string[];
  }) => Promise<void>;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] = useState(deck.visibility);
  const [emailsRaw, setEmailsRaw] = useState(deck.whitelistEmails.join("\n"));
  const [saving, setSaving] = useState(false);
  const shareUrl =
    typeof window === "undefined"
      ? `/deck/${deck._id}`
      : `${window.location.origin}/deck/${deck._id}`;

  const parsedEmails = useMemo(
    () =>
      emailsRaw
        .split(/[,\n]/)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    [emailsRaw],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deck Sharing</DialogTitle>
          <DialogDescription>
            Control access mode and whitelist for this deck.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Visibility</p>
            <div className="flex flex-wrap gap-2">
              {visibilityOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setVisibility(option)}
                  className="rounded-full"
                >
                  <Badge variant={visibility === option ? "default" : "outline"}>
                    {option}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Share URL</p>
            <Input
              readOnly
              value={shareUrl}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>

          {visibility === "whitelist" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Whitelist Emails</p>
              <Textarea
                value={emailsRaw}
                onChange={(event) => setEmailsRaw(event.target.value)}
                placeholder="student@school.edu"
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                {parsedEmails.length} email{parsedEmails.length === 1 ? "" : "s"} parsed
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  deckId: String(deck._id),
                  visibility,
                  whitelistEmails: parsedEmails,
                });
                setOpen(false);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

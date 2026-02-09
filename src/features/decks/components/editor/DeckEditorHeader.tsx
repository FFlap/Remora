import { UserButton } from "@clerk/tanstack-react-start";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, Clock3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareDeckDialog } from "@/features/sharing/ShareDeckDialog";
import type { Doc } from "@/lib/convexApi";

type SaveStatusProps = {
  state: "idle" | "saving" | "saved" | "error";
  onRetry: () => void;
};

function SaveStatus({ state, onRetry }: SaveStatusProps) {
  if (state === "saving") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving...
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <Clock3 className="h-3.5 w-3.5" />
          Save failed
        </div>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Check className="h-3.5 w-3.5 text-emerald-600" />
      Saved
    </div>
  );
}

type DeckEditorHeaderProps = {
  deckId: string;
  deck: Doc<"decks">;
  autosaveState: "idle" | "saving" | "saved" | "error";
  onAutosaveRetry: () => void;
  shareDialogOpen: boolean;
  onShareDialogOpenChange: (open: boolean) => void;
  onSaveSharing: (payload: {
    deckId: string;
    visibility: "public" | "unlisted" | "private" | "whitelist";
    whitelistEmails: string[];
  }) => Promise<void>;
};

export function DeckEditorHeader({
  deckId,
  deck,
  autosaveState,
  onAutosaveRetry,
  shareDialogOpen,
  onShareDialogOpenChange,
  onSaveSharing,
}: DeckEditorHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="h-12 border-b border-border flex items-center justify-between px-4 flex-shrink-0 bg-background">
      <div className="flex items-center gap-2 text-sm">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0"
          aria-label="Back to deck"
          title="Back to deck"
          onClick={() =>
            void navigate({
              to: "/deck/$deckId",
              params: { deckId },
            })
          }
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="max-w-[30vw] truncate text-muted-foreground">{deck.title}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="font-medium text-foreground">Edit Card</span>
        <div className="ml-2">
          <SaveStatus state={autosaveState} onRetry={onAutosaveRetry} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ShareDeckDialog
          deck={deck}
          open={shareDialogOpen}
          onOpenChange={onShareDialogOpenChange}
          manageAccessRequests
          onSave={async (payload) => {
            await onSaveSharing({
              deckId: payload.deckId as string,
              visibility: payload.visibility,
              whitelistEmails: payload.whitelistEmails,
            });
          }}
        />
        <UserButton />
      </div>
    </header>
  );
}

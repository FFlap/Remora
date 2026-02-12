import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ShareDeckAccessRequestsPanel } from "@/features/sharing/ShareDeckAccessRequestsPanel";
import {
  type ShareDeckVisibility,
  useShareDeckDialogState,
} from "@/features/sharing/useShareDeckDialogState";
import type { Doc } from "@/lib/convexApi";

const visibilityOptions = ["public", "unlisted", "private", "whitelist"] as const;

type DeckDoc = Doc<"decks">;

type ShareDeckDialogProps = {
  deck: DeckDoc;
  onSave: (payload: {
    deckId: string;
    visibility: ShareDeckVisibility;
    whitelistEmails: string[];
  }) => Promise<void>;
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  manageAccessRequests?: boolean;
};

export function ShareDeckDialog({
  deck,
  onSave,
  triggerLabel = "Share",
  open,
  onOpenChange,
  manageAccessRequests = false,
}: ShareDeckDialogProps) {
  const {
    isOpen,
    setIsOpen,
    visibility,
    setVisibility,
    emailsRaw,
    setEmailsRaw,
    parsedEmails,
    shareUrl,
    saving,
    localError,
    saveChanges,
  } = useShareDeckDialogState({
    deck,
    onSave,
    open,
    onOpenChange,
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deck Sharing</DialogTitle>
          <DialogDescription>Control access mode and whitelist for this deck.</DialogDescription>
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
                  <Badge variant={visibility === option ? "default" : "outline"}>{option}</Badge>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Share URL</p>
            <Input readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />
          </div>

          {visibility === "whitelist" && (
            <>
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

              {manageAccessRequests && isOpen ? (
                <ShareDeckAccessRequestsPanel deckId={String(deck._id)} />
              ) : null}
            </>
          )}

          {Boolean(localError) && <p className="text-xs text-destructive">{localError}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={saveChanges}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

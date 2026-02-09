import { Button } from "@/components/ui/button";
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
import type { DeckVisibility } from "@/features/decks/hooks/useDeckSettingsDialog";
import type { RefObject } from "react";

type DeckSettingsDialogProps = {
  open: boolean;
  title: string;
  description: string;
  visibility: DeckVisibility;
  savingSettings: boolean;
  titleRef: RefObject<HTMLInputElement | null>;
  descriptionRef: RefObject<HTMLTextAreaElement | null>;
  visibilityRef: RefObject<HTMLSelectElement | null>;
  onOpenChange: (open: boolean) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onVisibilityChange: (value: DeckVisibility) => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
};

export function DeckSettingsDialog({
  open,
  title,
  description,
  visibility,
  savingSettings,
  titleRef,
  descriptionRef,
  visibilityRef,
  onOpenChange,
  onTitleChange,
  onDescriptionChange,
  onVisibilityChange,
  onCancel,
  onSave,
}: DeckSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deck settings</DialogTitle>
          <DialogDescription>Update name, description, and share status.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="deck-settings-title" className="text-sm font-medium">
              Deck name
            </label>
            <Input
              id="deck-settings-title"
              ref={titleRef}
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Deck title"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="deck-settings-description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="deck-settings-description"
              ref={descriptionRef}
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="What this deck is about"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="deck-settings-visibility" className="text-sm font-medium">
              Share status
            </label>
            <select
              id="deck-settings-visibility"
              ref={visibilityRef}
              value={visibility}
              onChange={(event) => onVisibilityChange(event.target.value as DeckVisibility)}
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
          <Button variant="outline" onClick={onCancel} disabled={savingSettings}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              void onSave();
            }}
            disabled={savingSettings || !title.trim()}
          >
            {savingSettings ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

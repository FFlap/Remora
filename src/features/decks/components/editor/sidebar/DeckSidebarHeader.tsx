import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeckSidebarHeader({
  onCreateSection,
}: {
  onCreateSection: () => Promise<void>;
}) {
  return (
    <div className="p-3 border-b border-border flex-shrink-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Card Position
        </h3>
        <Button type="button" size="sm" variant="outline" onClick={() => void onCreateSection()}>
          <Plus className="h-4 w-4" /> Section
        </Button>
      </div>
    </div>
  );
}

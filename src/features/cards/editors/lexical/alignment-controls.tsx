import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TextAlignment } from "./types";

export type AlignmentOption = TextAlignment;

const ALIGNMENT_OPTIONS: Array<{ label: string; value: AlignmentOption }> = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
  { label: "Justify", value: "justify" },
];

function AlignmentIcon({
  alignment,
  className,
}: {
  alignment: AlignmentOption;
  className?: string;
}) {
  if (alignment === "center") return <AlignCenter className={className} />;
  if (alignment === "right") return <AlignRight className={className} />;
  if (alignment === "justify") return <AlignJustify className={className} />;
  return <AlignLeft className={className} />;
}

export function AlignmentDropdown({
  value,
  onChange,
  disabled = false,
  triggerClassName,
}: {
  value: AlignmentOption;
  onChange: (value: AlignmentOption) => void;
  disabled?: boolean;
  triggerClassName?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40",
            triggerClassName,
          )}
          onMouseDown={(event) => {
            if (disabled) return;
            event.preventDefault();
          }}
          title="Text alignment"
          aria-label="Text alignment"
        >
          <AlignmentIcon alignment={value} className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-36">
        {ALIGNMENT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onChange(option.value)}
            className={cn(
              "gap-2",
              value === option.value ? "bg-accent text-accent-foreground" : "",
            )}
          >
            <AlignmentIcon alignment={option.value} className="h-4 w-4" />
            <span>{option.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

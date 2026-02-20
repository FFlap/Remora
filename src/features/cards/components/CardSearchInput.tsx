import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CardSearchInputProps = {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  dataTestId?: string;
  className?: string;
};

export function CardSearchInput({
  value,
  onChange,
  placeholder = "Search cards...",
  dataTestId,
  className,
}: CardSearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        data-testid={dataTestId}
        className="h-8 border-border/80 bg-white pl-8 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-ring/70"
      />
    </div>
  );
}

import type * as React from "react";
import { cn } from "@/lib/utils";

function Separator({ className, ...props }: React.ComponentProps<"hr">) {
  return <hr className={cn("h-px w-full border-0 bg-border", className)} {...props} />;
}

export { Separator };

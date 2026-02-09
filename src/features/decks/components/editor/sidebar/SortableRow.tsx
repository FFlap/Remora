import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

export function SortableRow({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const verticalOnlyTransform = transform ? { ...transform, x: 0 } : null;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(verticalOnlyTransform),
        transition,
      }}
      className={cn(
        "touch-none cursor-grab active:cursor-grabbing",
        isDragging ? "opacity-60" : "opacity-100",
      )}
    >
      {children}
    </div>
  );
}

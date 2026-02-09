import { useEffect } from "react";
import type { SideOperation } from "@/features/cards/side-ir/ops";
import type { SideIR } from "@/features/cards/side-ir/types";

type SideHistoryLike = {
  present: SideIR;
  apply: (operation: SideOperation | SideOperation[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export function useSideHistoryShortcuts(sideHistory: SideHistoryLike) {
  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier) return;

      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          sideHistory.redo();
        } else {
          sideHistory.undo();
        }
      }

      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        sideHistory.redo();
      }
    };

    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [sideHistory]);
}

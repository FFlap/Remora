import { useEffect } from "react";
import type { SideOperation } from "@/features/cards/side-model/ops";
import type { SideModel } from "@/features/cards/side-model/types";

type SideHistoryLike = {
  present: SideModel;
  apply: (
    operations: SideOperation[],
    meta?: {
      source?: "quick" | "creative" | "system";
      batchKey?: string;
      coalesceMs?: number;
    },
  ) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export function useSideHistoryShortcuts(sideHistory: SideHistoryLike) {
  useEffect(() => {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Shortcut guard intentionally handles editable targets, override opt-in, and undo/redo variants.
    const onKeydown = (event: KeyboardEvent) => {
      const target = event.target;
      const targetElement = target instanceof Element ? target : null;
      const allowSideHistory = targetElement?.closest('[data-allow-side-history="true"]') !== null;
      const isTextEditingTarget =
        targetElement?.closest(
          'input, textarea, select, [contenteditable="true"], [contenteditable]:not([contenteditable="false"])',
        ) !== null;
      if (isTextEditingTarget && !allowSideHistory) {
        return;
      }

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

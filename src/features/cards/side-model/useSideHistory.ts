import { useMemo, useState } from "react";
import { applyOperations, type SideOperation } from "./ops";
import type { SideModel } from "./types";

type Source = "quick" | "creative" | "system";

type HistoryEntry = {
  source: Source;
  timestamp: number;
  batchKey?: string;
  operations: SideOperation[];
  inverse: SideOperation[];
};

const DEFAULT_COALESCE_MS: Record<Source, number> = {
  quick: 900,
  creative: 0,
  system: 0,
};

export function useSideHistory(initial: SideModel) {
  const [present, setPresent] = useState(initial);
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  const api = useMemo(
    () => ({
      present,
      canUndo,
      canRedo,
      setPresent,
      reset(next: SideModel) {
        setPresent(next);
        setUndoStack([]);
        setRedoStack([]);
      },
      apply(
        operations: SideOperation[],
        meta?: {
          source?: Source;
          batchKey?: string;
          coalesceMs?: number;
        },
      ) {
        if (operations.length === 0) {
          return;
        }

        setPresent((current) => {
          const { next, inverse } = applyOperations(current, operations);
          const source = meta?.source ?? "system";
          const timestamp = Date.now();
          const coalesceMs = meta?.coalesceMs ?? DEFAULT_COALESCE_MS[source];

          setUndoStack((existing) => {
            const previous = existing[existing.length - 1];
            const canCoalesce =
              previous &&
              previous.source === source &&
              previous.batchKey === meta?.batchKey &&
              timestamp - previous.timestamp <= coalesceMs;

            if (!canCoalesce) {
              return [
                ...existing,
                {
                  source,
                  timestamp,
                  batchKey: meta?.batchKey,
                  operations,
                  inverse,
                },
              ];
            }

            return [
              ...existing.slice(0, -1),
              {
                ...previous,
                timestamp,
                operations: [...previous.operations, ...operations],
                inverse: [...inverse, ...previous.inverse],
              },
            ];
          });

          setRedoStack([]);
          return next;
        });
      },
      undo() {
        setUndoStack((currentUndo) => {
          const entry = currentUndo[currentUndo.length - 1];
          if (!entry) {
            return currentUndo;
          }

          setPresent((current) => applyOperations(current, entry.inverse).next);
          setRedoStack((currentRedo) => [...currentRedo, entry]);
          return currentUndo.slice(0, -1);
        });
      },
      redo() {
        setRedoStack((currentRedo) => {
          const entry = currentRedo[currentRedo.length - 1];
          if (!entry) {
            return currentRedo;
          }

          setPresent((current) => applyOperations(current, entry.operations).next);
          setUndoStack((currentUndo) => [...currentUndo, entry]);
          return currentRedo.slice(0, -1);
        });
      },
    }),
    [present, canUndo, canRedo],
  );

  return api;
}

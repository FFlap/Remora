import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SideIR } from "../side-ir/types";

type SaveState = "idle" | "saving" | "saved" | "error";

export function useAutosaveSide({
  cardId,
  sideIndex,
  side,
  mode,
  onSave,
}: {
  cardId: string;
  sideIndex: number;
  side: SideIR;
  mode: "quick" | "creative";
  onSave: (params: {
    cardId: string;
    index: number;
    sideIR: SideIR;
    lastEditedMode: "quick" | "creative";
  }) => Promise<unknown>;
}) {
  const [state, setState] = useState<SaveState>("idle");
  const [lastError, setLastError] = useState<string | null>(null);

  const lastSaved = useRef<string>(JSON.stringify(side));
  const pending = useRef<string>(lastSaved.current);
  const timeoutRef = useRef<number | null>(null);

  const debounceMs = mode === "quick" ? 700 : 350;

  const persist = useCallback(async () => {
    if (pending.current === lastSaved.current) {
      return;
    }

    setState("saving");
    setLastError(null);

    try {
      const parsed = JSON.parse(pending.current) as SideIR;
      await onSave({
        cardId,
        index: sideIndex,
        sideIR: parsed,
        lastEditedMode: mode,
      });
      lastSaved.current = pending.current;
      setState("saved");
    } catch (error) {
      setState("error");
      setLastError(error instanceof Error ? error.message : "Save failed");
    }
  }, [cardId, sideIndex, mode, onSave]);

  useEffect(() => {
    pending.current = JSON.stringify(side);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      void persist();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [side, debounceMs, persist]);

  const retry = useCallback(() => {
    void persist();
  }, [persist]);

  const label = useMemo(() => {
    if (state === "saving") return "Saving...";
    if (state === "saved") return "Saved";
    if (state === "error") return "Save failed";
    return "Idle";
  }, [state]);

  return {
    state,
    label,
    error: lastError,
    retry,
    flush: persist,
  };
}

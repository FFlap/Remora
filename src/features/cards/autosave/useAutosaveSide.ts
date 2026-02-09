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
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const mountedRef = useRef(true);
  const sideKeyRef = useRef(`${cardId}:${sideIndex}`);

  const debounceMs = mode === "quick" ? 700 : 350;

  const enqueueSave = useCallback(
    async (snapshot: string, trackState: boolean) => {
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        if (snapshot === lastSaved.current) return;
        const saveKey = `${cardId}:${sideIndex}`;

        if (trackState && mountedRef.current) {
          setState("saving");
          setLastError(null);
        }

        try {
          const parsed = JSON.parse(snapshot) as SideIR;
          await onSave({
            cardId,
            index: sideIndex,
            sideIR: parsed,
            lastEditedMode: mode,
          });
          if (sideKeyRef.current !== saveKey) {
            return;
          }
          lastSaved.current = snapshot;
          if (trackState && mountedRef.current && pending.current === snapshot) {
            setState("saved");
          }
        } catch (error) {
          if (sideKeyRef.current !== saveKey) {
            return;
          }
          if (trackState && mountedRef.current) {
            setState("error");
            setLastError(error instanceof Error ? error.message : "Save failed");
          }
        }
      });

      await saveQueueRef.current;
    },
    [cardId, sideIndex, mode, onSave],
  );

  const persist = useCallback(async () => {
    let snapshot = pending.current;
    while (snapshot !== lastSaved.current) {
      await enqueueSave(snapshot, true);
      snapshot = pending.current;
    }
  }, [enqueueSave]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    sideKeyRef.current = `${cardId}:${sideIndex}`;
    const serialized = JSON.stringify(side);
    lastSaved.current = serialized;
    pending.current = serialized;
    setState("idle");
    setLastError(null);
  }, [cardId, sideIndex]);

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
      if (pending.current !== lastSaved.current) {
        const snapshot = pending.current;
        void enqueueSave(snapshot, false);
      }
    };
  }, [side, debounceMs, persist, enqueueSave]);

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

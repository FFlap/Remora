import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SideIR } from "../side-ir/types";

type SaveState = "idle" | "saving" | "saved" | "error";

function shouldTrackState(trackState: boolean, mounted: boolean) {
  return trackState && mounted;
}

function startSaveState({
  trackState,
  mounted,
  setState,
  setLastError,
}: {
  trackState: boolean;
  mounted: boolean;
  setState: (state: SaveState) => void;
  setLastError: (value: string | null) => void;
}) {
  if (!shouldTrackState(trackState, mounted)) return;
  setState("saving");
  setLastError(null);
}

function completeSaveState({
  snapshot,
  trackState,
  mounted,
  pendingSnapshot,
  setState,
}: {
  snapshot: string;
  trackState: boolean;
  mounted: boolean;
  pendingSnapshot: string;
  setState: (state: SaveState) => void;
}) {
  if (!shouldTrackState(trackState, mounted)) return;
  if (pendingSnapshot === snapshot) {
    setState("saved");
  }
}

function failSaveState({
  error,
  trackState,
  mounted,
  setState,
  setLastError,
}: {
  error: unknown;
  trackState: boolean;
  mounted: boolean;
  setState: (state: SaveState) => void;
  setLastError: (value: string | null) => void;
}) {
  if (!shouldTrackState(trackState, mounted)) return;
  setState("error");
  setLastError(error instanceof Error ? error.message : "Save failed");
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Hook coordinates debounced queueing, lifecycle, and status updates in one place for consistency.
export function useAutosaveSide({
  cardId,
  sideIndex,
  sideId,
  sideIdentityKey,
  side,
  mode,
  onSave,
}: {
  cardId: string;
  sideIndex: number;
  sideId?: string;
  sideIdentityKey?: string;
  side: SideIR;
  mode: "quick" | "creative";
  onSave: (params: {
    cardId: string;
    index: number;
    sideId?: string;
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
  const sideKey = `${cardId}:${sideIndex}:${sideIdentityKey ?? ""}`;
  const sideKeyRef = useRef(sideKey);
  const initializedKeyRef = useRef<string | null>(null);

  const debounceMs = mode === "quick" ? 700 : 350;

  const enqueueSave = useCallback(
    async (snapshot: string, trackState: boolean) => {
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        if (snapshot === lastSaved.current) return;
        const saveKey = sideKey;
        if (sideKeyRef.current !== saveKey) {
          return;
        }
        startSaveState({
          trackState,
          mounted: mountedRef.current,
          setState,
          setLastError,
        });

        try {
          if (sideKeyRef.current !== saveKey) {
            return;
          }
          const parsed = JSON.parse(snapshot) as SideIR;
          await onSave({
            cardId,
            index: sideIndex,
            sideId,
            sideIR: parsed,
            lastEditedMode: mode,
          });
          if (sideKeyRef.current !== saveKey) {
            return;
          }
          lastSaved.current = snapshot;
          completeSaveState({
            snapshot,
            trackState,
            mounted: mountedRef.current,
            pendingSnapshot: pending.current,
            setState,
          });
        } catch (error) {
          if (sideKeyRef.current !== saveKey) {
            return;
          }
          failSaveState({
            error,
            trackState,
            mounted: mountedRef.current,
            setState,
            setLastError,
          });
        }
      });

      await saveQueueRef.current;
    },
    [cardId, mode, onSave, sideId, sideIndex, sideKey],
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
    const key = sideKey;
    sideKeyRef.current = key;
    if (initializedKeyRef.current === key) {
      return;
    }

    initializedKeyRef.current = key;
    const serialized = JSON.stringify(side);
    lastSaved.current = serialized;
    pending.current = serialized;
    setState("idle");
    setLastError(null);
  }, [sideKey, side]);

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

  useEffect(() => {
    return () => {
      if (pending.current !== lastSaved.current) {
        const snapshot = pending.current;
        void enqueueSave(snapshot, false);
      }
    };
  }, [enqueueSave]);

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

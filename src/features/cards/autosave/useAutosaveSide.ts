import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SideModel } from "../side-model/types";

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
  side: SideModel;
  mode: "quick" | "creative";
  onSave: (params: {
    cardId: string;
    index: number;
    sideId?: string;
    sideModel: SideModel;
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
      let didSave = false;
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Queued save pipeline short-circuits stale side keys and updates save state atomically.
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        if (snapshot === lastSaved.current) {
          didSave = true;
          return;
        }
        const saveKey = sideKey;
        if (sideKeyRef.current !== saveKey) {
          didSave = true;
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
          const parsed = JSON.parse(snapshot) as SideModel;
          await onSave({
            cardId,
            index: sideIndex,
            sideId,
            sideModel: parsed,
            lastEditedMode: mode,
          });
          if (sideKeyRef.current !== saveKey) {
            didSave = true;
            return;
          }
          lastSaved.current = snapshot;
          didSave = true;
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
      return didSave;
    },
    [cardId, mode, onSave, sideId, sideIndex, sideKey],
  );

  const persist = useCallback(async () => {
    const snapshot = pending.current;
    if (snapshot === lastSaved.current) {
      if (mountedRef.current) {
        setState("saved");
      }
      return;
    }

    const didSave = await enqueueSave(snapshot, true);
    if (!didSave) {
      return;
    }

    if (pending.current !== lastSaved.current) {
      await enqueueSave(pending.current, true);
    }

    if (mountedRef.current && pending.current === lastSaved.current) {
      setState("saved");
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
    if (pending.current !== lastSaved.current && mountedRef.current) {
      setState("saving");
      setLastError(null);
    }

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

import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useAddSide,
  useDeleteSide,
  useEditorCard,
  useSaveSide,
} from "@/features/cards/api/useCardsApi";
import { useAutosaveSide } from "@/features/cards/autosave/useAutosaveSide";
import { asSideIR, createDefaultSideIR } from "@/features/cards/side-ir/types";
import { useSideHistory } from "@/features/cards/side-ir/useSideHistory";
import { useDeckEditShell } from "@/features/decks/api/useDecksApi";
import { DeckEditorHeader } from "@/features/decks/components/editor/DeckEditorHeader";
import { DeckEditorSidebar } from "@/features/decks/components/editor/DeckEditorSidebar";
import { DeckEditorWorkspace } from "@/features/decks/components/editor/DeckEditorWorkspace";
import { useDeckEditorSelection } from "@/features/decks/components/editor/useDeckEditorSelection";
import { useSideHistoryShortcuts } from "@/features/decks/components/editor/useSideHistoryShortcuts";
import type { DeckEditorCardData, DeckEditShellData } from "@/features/decks/types/editor";
import { useUpdateSharing } from "@/features/sharing/api/useSharingApi";
import type { Id } from "@/lib/convexApi";

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Screen composes hook-driven editor orchestration across sidebar/workspace/header boundaries.
export function DeckEditorScreen({
  deckId,
  preselectedCardId,
}: {
  deckId: string;
  preselectedCardId?: string;
}) {
  const navigate = useNavigate();
  const data = useDeckEditShell(deckId) as DeckEditShellData | undefined;

  const updateSharing = useUpdateSharing();
  const addSide = useAddSide();
  const deleteSide = useDeleteSide();
  const saveSide = useSaveSide();

  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(preselectedCardId);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [activePreviewCardId, setActivePreviewCardId] = useState<string | undefined>(undefined);
  const previousSelectedCardIdRef = useRef<string | undefined>(preselectedCardId);
  const sideSnapshotRef = useRef(new Map<string, ReturnType<typeof asSideIR>>());

  const selectedCardData = useEditorCard(selectedCardId) as DeckEditorCardData | undefined;
  const {
    activeSideIndex,
    setActiveSideIndex,
    editorMode,
    setEditorMode,
    selectedCard,
    currentSideDoc,
  } = useDeckEditorSelection({
    data,
    deckId,
    preselectedCardId,
    navigate,
    selectedCardId,
    setSelectedCardId,
    selectedCardData,
  });
  const selectedCardDataForWorkspace =
    selectedCardData &&
    selectedCard &&
    String(selectedCardData.card._id) === String(selectedCard._id)
      ? selectedCardData
      : undefined;

  const sideHistory = useSideHistory(
    currentSideDoc ? asSideIR(currentSideDoc.sideIR) : createDefaultSideIR(),
  );
  const lastLoadedSideKeyRef = useRef<string | null>(null);
  const resetSideHistoryRef = useRef(sideHistory.reset);
  const getShellSideForCard = useCallback(
    (cardId: string | undefined) => {
      if (!cardId) {
        return createDefaultSideIR();
      }

      const shellCard = data?.sections
        .flatMap((section) => section.cards)
        .find((card) => String(card._id) === cardId);
      return shellCard?.frontSide ? asSideIR(shellCard.frontSide.sideIR) : createDefaultSideIR();
    },
    [data],
  );

  useEffect(() => {
    resetSideHistoryRef.current = sideHistory.reset;
  }, [sideHistory.reset]);

  useEffect(() => {
    if (!selectedCardId || !currentSideDoc) {
      return;
    }

    const snapshotKey = `${selectedCardId}:${String(currentSideDoc._id)}`;
    sideSnapshotRef.current.set(snapshotKey, sideHistory.present);
  }, [selectedCardId, currentSideDoc, sideHistory.present]);

  useEffect(() => {
    if (previousSelectedCardIdRef.current === selectedCardId) {
      return;
    }
    previousSelectedCardIdRef.current = selectedCardId;
    lastLoadedSideKeyRef.current = null;

    if (!selectedCardId) {
      setActivePreviewCardId(undefined);
      resetSideHistoryRef.current(createDefaultSideIR());
      return;
    }

    setActiveSideIndex(0);
    resetSideHistoryRef.current(getShellSideForCard(selectedCardId));
    setActivePreviewCardId(selectedCardId);
  }, [getShellSideForCard, selectedCardId, setActiveSideIndex]);

  useEffect(() => {
    if (!currentSideDoc) {
      lastLoadedSideKeyRef.current = null;
      if (!selectedCardId) {
        setActivePreviewCardId(undefined);
      }
      return;
    }

    const currentSideKey = `${selectedCardId ?? ""}:${String(currentSideDoc._id)}:${currentSideDoc.index}:${currentSideDoc.updatedAt}`;
    if (lastLoadedSideKeyRef.current === currentSideKey) {
      return;
    }

    lastLoadedSideKeyRef.current = currentSideKey;
    const snapshotKey = `${selectedCardId ?? ""}:${String(currentSideDoc._id)}`;
    const nextSide = sideSnapshotRef.current.get(snapshotKey) ?? asSideIR(currentSideDoc.sideIR);
    setActiveSideIndex(currentSideDoc.index);
    resetSideHistoryRef.current(nextSide);
    setActivePreviewCardId(selectedCardId);
  }, [currentSideDoc, selectedCardId, setActiveSideIndex]);

  const autosave = useAutosaveSide({
    cardId: selectedCardId ?? "",
    sideIndex: currentSideDoc?.index ?? 0,
    sideId: currentSideDoc ? String(currentSideDoc._id) : undefined,
    sideIdentityKey: currentSideDoc ? String(currentSideDoc._id) : undefined,
    side: sideHistory.present,
    mode: editorMode,
    onSave: async (payload) => {
      if (!selectedCardId) return;
      await saveSide({
        cardId: payload.cardId as Id<"cards">,
        index: payload.index,
        sideId: payload.sideId as Id<"cardSides"> | undefined,
        sideIR: payload.sideIR,
        lastEditedMode: payload.lastEditedMode,
      });
    },
  });

  useSideHistoryShortcuts(sideHistory);

  if (!data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading deck...</div>;
  }

  const sortedSides = [...(selectedCardDataForWorkspace?.sides ?? [])].sort(
    (a, b) => a.index - b.index,
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <DeckEditorHeader
        deckId={deckId}
        deck={data.deck}
        autosaveState={autosave.state}
        onAutosaveRetry={autosave.retry}
        shareDialogOpen={shareDialogOpen}
        onShareDialogOpenChange={setShareDialogOpen}
        onSaveSharing={async (payload) => {
          await updateSharing({
            deckId: payload.deckId as Id<"decks">,
            visibility: payload.visibility,
            whitelistEmails: payload.whitelistEmails,
          });
          toast.success("Sharing updated");
        }}
      />

      <div className="deck-editor-layout flex-1 flex min-h-0 overflow-hidden">
        <DeckEditorSidebar
          deckId={deckId}
          data={data}
          selectedCardId={selectedCardId}
          activeSidePreview={sideHistory.present}
          activePreviewCardId={activePreviewCardId}
          onBeforeSelectCard={autosave.flush}
          onSelectCard={(cardId) => {
            lastLoadedSideKeyRef.current = null;
            resetSideHistoryRef.current(getShellSideForCard(cardId));
            setActivePreviewCardId(cardId);
            setSelectedCardId(cardId);
          }}
          onResetActiveSideIndex={() => setActiveSideIndex(0)}
        />

        <DeckEditorWorkspace
          selectedCard={selectedCard}
          selectedCardData={selectedCardDataForWorkspace}
          sideHistory={sideHistory}
          editorMode={editorMode}
          setEditorMode={setEditorMode}
          sortedSides={sortedSides}
          activeSideIndex={activeSideIndex}
          onSelectSide={(index) => {
            const selectedSide = sortedSides.find((side) => side.index === index);
            if (selectedSide) {
              const snapshotKey = `${selectedCardId ?? ""}:${String(selectedSide._id)}`;
              const nextSide =
                sideSnapshotRef.current.get(snapshotKey) ?? asSideIR(selectedSide.sideIR);
              resetSideHistoryRef.current(nextSide);
              setActivePreviewCardId(selectedCardId);
            }
            setActiveSideIndex(index);
          }}
          onAddSide={async () => {
            if (!selectedCard) return;
            await autosave.flush();
            await addSide({ cardId: selectedCard._id });
            lastLoadedSideKeyRef.current = null;
            resetSideHistoryRef.current(createDefaultSideIR(String(sortedSides.length + 1)));
            setActivePreviewCardId(selectedCardId);
            setActiveSideIndex(sortedSides.length);
          }}
          onDeleteSide={async () => {
            if (!selectedCard) return;
            const sideToDelete = sortedSides.find((side) => side.index === activeSideIndex) ?? null;
            const fallbackSide =
              sortedSides.find((side) => side.index > activeSideIndex) ??
              sortedSides[activeSideIndex - 1] ??
              null;
            const nextIndex =
              fallbackSide && fallbackSide.index > activeSideIndex
                ? activeSideIndex
                : Math.max(0, activeSideIndex - 1);
            await autosave.flush();
            await deleteSide({ cardId: selectedCard._id, index: activeSideIndex });
            if (sideToDelete) {
              sideSnapshotRef.current.delete(`${selectedCardId ?? ""}:${String(sideToDelete._id)}`);
            }
            if (fallbackSide) {
              lastLoadedSideKeyRef.current = null;
              const snapshotKey = `${selectedCardId ?? ""}:${String(fallbackSide._id)}`;
              const nextSide =
                sideSnapshotRef.current.get(snapshotKey) ?? asSideIR(fallbackSide.sideIR);
              resetSideHistoryRef.current(nextSide);
              setActivePreviewCardId(selectedCardId);
            }
            setActiveSideIndex(nextIndex);
          }}
        />
      </div>
    </div>
  );
}

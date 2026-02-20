import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { SideCardPreview } from "@/features/cards/components/SideCardPreview";
import type { SideOperation } from "@/features/cards/side-model/ops";
import type {
  EmbedBlock,
  ImageBlock,
  RichTextBlock,
  SideElement,
  SideModel,
} from "@/features/cards/side-model/types";
import { LexicalRichTextEditor } from "../LexicalRichTextEditor";

type QuickEditorContentProps = {
  side: SideModel;
  richText: RichTextBlock;
  richTextBlocks: RichTextBlock[];
  mediaElements: Array<ImageBlock | EmbedBlock>;
  cardBackground: string;
  setActiveRichTextId: (id: string) => void;
  onInsertImage: () => void;
  onInsertYouTube: () => void;
  onBackgroundChange: (background: string) => void;
  onApply: (
    operations: SideOperation[],
    meta?: {
      source?: "quick" | "creative" | "system";
      batchKey?: string;
      coalesceMs?: number;
    },
  ) => void;
};

type QuickLayoutMode = "split" | "stacked";

const QUICK_SPLIT_INPUT_FRACTION = 1.05;
const QUICK_SPLIT_PREVIEW_FRACTION = 0.95;
const STACK_ENTER_BUFFER_PX = 4;
const STACK_EXIT_BUFFER_PX = 28;
const MIN_SPLIT_INPUT_WIDTH_PX = 560;
const MIN_SPLIT_PREVIEW_WIDTH_PX = 500;
const UNSTACK_INPUT_WIDTH_BUFFER_PX = 72;
const UNSTACK_PREVIEW_WIDTH_BUFFER_PX = 64;

function parsePx(value: string | undefined) {
  const next = Number.parseFloat(value ?? "");
  return Number.isFinite(next) ? next : 0;
}

function parseAspectRatio(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!raw || raw === "auto") return null;

  if (!raw.includes("/")) {
    const asNumber = Number.parseFloat(raw);
    return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : null;
  }

  const [left, right] = raw.split("/");
  const numerator = Number.parseFloat(left ?? "");
  const denominator = Number.parseFloat(right ?? "");
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }
  return numerator / denominator;
}

function resolveCardAspect(previewCard: HTMLElement | null, fallbackCardRatio: number) {
  return (
    parseAspectRatio(previewCard ? getComputedStyle(previewCard).aspectRatio : undefined) ??
    (fallbackCardRatio > 0 ? fallbackCardRatio : 1.5)
  );
}

function resolveEditorContentRow(surface: HTMLElement, current: HTMLElement | null) {
  if (current?.isConnected) {
    return current;
  }
  return surface.closest('[data-testid="editor-content-row"]') as HTMLElement | null;
}

function getAvailableSplitSize(surface: HTMLElement, editorContentRow: HTMLElement | null) {
  if (!editorContentRow) {
    return {
      width: surface.clientWidth,
      height: surface.clientHeight,
    };
  }

  const surfaceRect = surface.getBoundingClientRect();
  const contentRect = editorContentRow.getBoundingClientRect();
  const horizontalInsetsPx =
    Math.max(0, surfaceRect.left - contentRect.left) +
    Math.max(0, contentRect.right - surfaceRect.right);
  const verticalInsetsPx =
    Math.max(0, surfaceRect.top - contentRect.top) +
    Math.max(0, contentRect.bottom - surfaceRect.bottom);
  return {
    width: Math.max(0, editorContentRow.clientWidth - horizontalInsetsPx),
    height: Math.max(0, editorContentRow.clientHeight - verticalInsetsPx),
  };
}

function getSplitFitMetrics({
  surface,
  previewPanel,
  previewStage,
  cardAspect,
  availableSplitWidth,
}: {
  surface: HTMLElement;
  previewPanel: HTMLElement;
  previewStage: HTMLElement;
  cardAspect: number;
  availableSplitWidth: number;
}) {
  const surfaceStyle = getComputedStyle(surface);
  const gapPx = parsePx(surfaceStyle.columnGap) || parsePx(surfaceStyle.gap);
  const fitWidth = Math.max(1, Math.min(surface.clientWidth, availableSplitWidth));
  const splitTotalWidth = Math.max(1, fitWidth - gapPx);
  const splitPreviewWidth =
    splitTotalWidth *
    (QUICK_SPLIT_PREVIEW_FRACTION / (QUICK_SPLIT_INPUT_FRACTION + QUICK_SPLIT_PREVIEW_FRACTION));
  const splitInputWidth =
    Math.max(1, fitWidth - gapPx) *
    (QUICK_SPLIT_INPUT_FRACTION / (QUICK_SPLIT_INPUT_FRACTION + QUICK_SPLIT_PREVIEW_FRACTION));
  const requiredCardHeight = splitPreviewWidth / Math.max(0.01, cardAspect);
  const panelChromeHeight = Math.max(0, previewPanel.offsetHeight - previewStage.clientHeight);
  return {
    splitInputWidth,
    splitPreviewWidth,
    requiredPreviewPanelHeight: requiredCardHeight + panelChromeHeight,
  };
}

function getNextLayoutMode({
  current,
  splitInputWidth,
  splitPreviewWidth,
  requiredPreviewPanelHeight,
  availableSplitHeight,
}: {
  current: QuickLayoutMode;
  splitInputWidth: number;
  splitPreviewWidth: number;
  requiredPreviewPanelHeight: number;
  availableSplitHeight: number;
}): QuickLayoutMode {
  const shouldStackByWidth =
    splitInputWidth < MIN_SPLIT_INPUT_WIDTH_PX || splitPreviewWidth < MIN_SPLIT_PREVIEW_WIDTH_PX;
  const canUnstackByWidth =
    splitInputWidth >= MIN_SPLIT_INPUT_WIDTH_PX + UNSTACK_INPUT_WIDTH_BUFFER_PX &&
    splitPreviewWidth >= MIN_SPLIT_PREVIEW_WIDTH_PX + UNSTACK_PREVIEW_WIDTH_BUFFER_PX;
  const shouldStackByHeight =
    requiredPreviewPanelHeight > availableSplitHeight - STACK_ENTER_BUFFER_PX;
  const canUnstackByHeight =
    requiredPreviewPanelHeight <= availableSplitHeight - STACK_EXIT_BUFFER_PX;

  if (current === "split") {
    return shouldStackByWidth || shouldStackByHeight ? "stacked" : "split";
  }
  return canUnstackByWidth && canUnstackByHeight ? "split" : "stacked";
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Quick panel composes text controls, palette, media fields, and live preview in one surface.
export function QuickEditorContent({
  side,
  richText,
  richTextBlocks,
  mediaElements,
  cardBackground,
  setActiveRichTextId,
  onInsertImage,
  onInsertYouTube,
  onBackgroundChange,
  onApply,
}: QuickEditorContentProps) {
  const [layoutMode, setLayoutMode] = useState<QuickLayoutMode>("split");
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const previewPanelRef = useRef<HTMLDivElement | null>(null);
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const previewCardRef = useRef<HTMLElement | null>(null);
  const editorContentRowRef = useRef<HTMLElement | null>(null);

  const resolvePreviewCard = useCallback(() => {
    if (previewCardRef.current?.isConnected) {
      return previewCardRef.current;
    }
    const surface = surfaceRef.current;
    if (!surface) return null;
    const card = surface.querySelector(
      '[data-testid="quick-live-preview-card"]',
    ) as HTMLElement | null;
    previewCardRef.current = card;
    return card;
  }, []);

  const recomputeLayoutMode = useCallback(() => {
    const surface = surfaceRef.current;
    const previewPanel = previewPanelRef.current;
    const previewStage = previewStageRef.current;
    if (!surface || !previewPanel || !previewStage) return;

    editorContentRowRef.current = resolveEditorContentRow(surface, editorContentRowRef.current);
    const previewCard = resolvePreviewCard();
    const cardAspect = resolveCardAspect(previewCard, side.layout.quickLayout.cardRatio);
    const { width: availableSplitWidth, height: availableSplitHeight } = getAvailableSplitSize(
      surface,
      editorContentRowRef.current,
    );
    if (availableSplitWidth <= 1 || availableSplitHeight <= 1) return;

    const { splitInputWidth, splitPreviewWidth, requiredPreviewPanelHeight } = getSplitFitMetrics({
      surface,
      previewPanel,
      previewStage,
      cardAspect,
      availableSplitWidth,
    });

    setLayoutMode((current) => {
      return getNextLayoutMode({
        current,
        splitInputWidth,
        splitPreviewWidth,
        requiredPreviewPanelHeight,
        availableSplitHeight,
      });
    });
  }, [resolvePreviewCard, side.layout.quickLayout.cardRatio]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    editorContentRowRef.current = surface.closest(
      '[data-testid="editor-content-row"]',
    ) as HTMLElement | null;
    const observer = new ResizeObserver(() => {
      recomputeLayoutMode();
    });
    observer.observe(surface);

    const previewCard = resolvePreviewCard();
    if (previewCard) {
      observer.observe(previewCard);
    }
    if (editorContentRowRef.current) {
      observer.observe(editorContentRowRef.current);
    }

    const rafId = window.requestAnimationFrame(() => {
      recomputeLayoutMode();
    });
    const handleResize = () => {
      recomputeLayoutMode();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [recomputeLayoutMode, resolvePreviewCard]);

  return (
    <div
      ref={surfaceRef}
      className="quick-editor-surface-grid min-h-0"
      data-layout={layoutMode}
      data-testid="quick-editor-surface-grid"
    >
      <div className="quick-editor-input-panel quick-editor-input-stack min-h-0 border-r border-border bg-background">
        <div className="quick-editor-panel-scroll flex min-h-0 flex-col space-y-4">
          <LexicalRichTextEditor
            editorKey={richText.id}
            value={richText.lexical}
            frameRounded={false}
            className="flex-1 min-h-0 !border-zinc-200"
            panelScrollable
            onImageInsert={onInsertImage}
            onYouTubeInsert={onInsertYouTube}
            textBlockOptions={richTextBlocks.map((block, index) => ({
              id: block.id,
              label: `Text ${index + 1}`,
            }))}
            activeTextBlockId={richText.id}
            onActiveTextBlockChange={setActiveRichTextId}
            cardBackgroundColor={cardBackground}
            onCardBackgroundChange={onBackgroundChange}
            cardBackgroundColorInputTestId="quick-card-bg-color-picker"
            showTableButton={false}
            placeholder="Enter the front of your card..."
            onChange={(nextLexical) => {
              onApply(
                [
                  {
                    kind: "updateElement",
                    elementId: richText.id,
                    patch: { lexical: nextLexical } as Partial<SideElement>,
                  },
                ],
                { source: "quick", batchKey: `typing-${richText.id}` },
              );
            }}
          />

          {mediaElements.length > 0 ? (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Media Blocks
              </p>
              {mediaElements.map((element) => (
                <Input
                  key={element.id}
                  value={element.url ?? ""}
                  onChange={(event) =>
                    onApply(
                      [
                        {
                          kind: "updateElement",
                          elementId: element.id,
                          patch: { url: event.target.value } as Partial<SideElement>,
                        },
                      ],
                      {
                        source: "quick",
                        batchKey: `media-${element.id}`,
                        coalesceMs: 500,
                      },
                    )
                  }
                  placeholder={
                    element.type === "image" ? "https://image-url..." : "https://youtube-url..."
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div
        ref={previewPanelRef}
        className="quick-editor-preview-panel quick-editor-preview-stack min-h-0 bg-muted/50"
      >
        <div className="quick-editor-preview-inner flex min-h-0 flex-col gap-3 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Live Preview
          </p>
          <div ref={previewStageRef} className="quick-editor-preview-stage flex min-h-0 flex-1">
            <SideCardPreview
              side={side}
              dataTestId="quick-live-preview-card"
              className="h-auto w-full min-w-0 shadow-[0_10px_20px_rgba(15,23,42,0.10)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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

const QUICK_CARD_COLORS = [
  { name: "White", value: "#ffffff" },
  { name: "Gray", value: "#f3f4f6" },
  { name: "Red", value: "#fee2e2" },
  { name: "Yellow", value: "#fef3c7" },
  { name: "Green", value: "#d1fae5" },
  { name: "Blue", value: "#dbeafe" },
  { name: "Indigo", value: "#e0e7ff" },
  { name: "Purple", value: "#ede9fe" },
  { name: "Pink", value: "#fce7f3" },
  { name: "Dark", value: "#0f172a" },
] as const;

type QuickEditorContentProps = {
  side: SideModel;
  richText: RichTextBlock;
  richTextBlocks: RichTextBlock[];
  mediaElements: Array<ImageBlock | EmbedBlock>;
  cardBackground: string;
  setActiveRichTextId: (id: string) => void;
  onAddTextBlock: () => void;
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

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Quick panel composes text controls, palette, media fields, and live preview in one surface.
export function QuickEditorContent({
  side,
  richText,
  richTextBlocks,
  mediaElements,
  cardBackground,
  setActiveRichTextId,
  onAddTextBlock,
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
    if (previewCardRef.current && previewCardRef.current.isConnected) {
      return previewCardRef.current;
    }
    const surface = surfaceRef.current;
    if (!surface) return null;
    const card = surface.querySelector('[data-testid="quick-live-preview-card"]') as HTMLElement | null;
    previewCardRef.current = card;
    return card;
  }, []);

  const recomputeLayoutMode = useCallback(() => {
    const surface = surfaceRef.current;
    const previewPanel = previewPanelRef.current;
    const previewStage = previewStageRef.current;
    if (!surface || !previewPanel || !previewStage) return;

    if (!editorContentRowRef.current || !editorContentRowRef.current.isConnected) {
      editorContentRowRef.current = surface.closest(
        '[data-testid="editor-content-row"]',
      ) as HTMLElement | null;
    }

    const previewCard = resolvePreviewCard();
    const cardAspect =
      parseAspectRatio(previewCard ? getComputedStyle(previewCard).aspectRatio : undefined) ??
      (side.layout.quickLayout.cardRatio > 0 ? side.layout.quickLayout.cardRatio : 1.5);

    const surfaceStyle = getComputedStyle(surface);
    const gapPx = parsePx(surfaceStyle.columnGap) || parsePx(surfaceStyle.gap);
    const surfaceRect = surface.getBoundingClientRect();
    let availableSplitWidth = surface.clientWidth;
    let availableSplitHeight = surface.clientHeight;

    const editorContentRow = editorContentRowRef.current;
    if (editorContentRow) {
      const contentRect = editorContentRow.getBoundingClientRect();
      const horizontalInsetsPx =
        Math.max(0, surfaceRect.left - contentRect.left) +
        Math.max(0, contentRect.right - surfaceRect.right);
      const verticalInsetsPx =
        Math.max(0, surfaceRect.top - contentRect.top) +
        Math.max(0, contentRect.bottom - surfaceRect.bottom);
      availableSplitWidth = Math.max(0, editorContentRow.clientWidth - horizontalInsetsPx);
      availableSplitHeight = Math.max(0, editorContentRow.clientHeight - verticalInsetsPx);
    }

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
    const requiredPreviewPanelHeight = requiredCardHeight + panelChromeHeight;
    if (availableSplitWidth <= 1 || availableSplitHeight <= 1) return;

    const shouldStackByWidth =
      splitInputWidth < MIN_SPLIT_INPUT_WIDTH_PX || splitPreviewWidth < MIN_SPLIT_PREVIEW_WIDTH_PX;
    const canUnstackByWidth =
      splitInputWidth >= MIN_SPLIT_INPUT_WIDTH_PX + UNSTACK_INPUT_WIDTH_BUFFER_PX &&
      splitPreviewWidth >= MIN_SPLIT_PREVIEW_WIDTH_PX + UNSTACK_PREVIEW_WIDTH_BUFFER_PX;
    const shouldStackByHeight = requiredPreviewPanelHeight > availableSplitHeight - STACK_ENTER_BUFFER_PX;
    const canUnstackByHeight = requiredPreviewPanelHeight <= availableSplitHeight - STACK_EXIT_BUFFER_PX;

    setLayoutMode((current) => {
      if (current === "split") {
        return shouldStackByWidth || shouldStackByHeight ? "stacked" : "split";
      }
      return canUnstackByWidth && canUnstackByHeight ? "split" : "stacked";
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
      <div className="quick-editor-input-panel quick-editor-input-stack min-h-0 rounded-xl border border-border bg-background p-4">
        <div className="quick-editor-panel-scroll flex min-h-0 flex-col space-y-4">
          <div className="flex items-center justify-between">
            {richTextBlocks.length > 1 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {richTextBlocks.map((block, index) => (
                  <button
                    key={block.id}
                    type="button"
                    className={[
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      block.id === richText.id
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    ].join(" ")}
                    onClick={() => setActiveRichTextId(block.id)}
                  >
                    Text {index + 1}
                  </button>
                ))}
              </div>
            ) : (
              <div className="h-7" />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={onAddTextBlock}
            >
              <Plus className="h-4 w-4" />
              Add text box
            </Button>
          </div>

          <LexicalRichTextEditor
            editorKey={richText.id}
            value={richText.lexical}
            panelScrollable
            onImageInsert={onInsertImage}
            onYouTubeInsert={onInsertYouTube}
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

          <div className="flex flex-wrap items-center gap-2" data-testid="quick-card-bg-palette">
            <label
              className="relative block h-7 w-7 cursor-pointer overflow-hidden rounded-md border-2 border-border shadow-sm transition-transform hover:scale-[1.04]"
              title="Custom card color"
            >
              <input
                type="color"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                value={cardBackground}
                data-testid="quick-card-bg-color-picker"
                onChange={(event) => onBackgroundChange(event.target.value)}
                aria-label="Custom card color"
              />
              <span className="block h-full w-full" style={{ backgroundColor: cardBackground }} />
            </label>

            {QUICK_CARD_COLORS.map((color) => {
              const isActive = cardBackground.toLowerCase() === color.value.toLowerCase();
              return (
                <button
                  key={color.value}
                  type="button"
                  aria-label={`Set card color ${color.name}`}
                  data-testid={`quick-card-bg-swatch-${color.value.replace("#", "")}`}
                  className={[
                    "h-6 w-6 rounded-md border-2 transition-all",
                    isActive
                      ? "border-foreground ring-1 ring-foreground/20 scale-110"
                      : "border-border hover:border-foreground/50 hover:scale-105",
                  ].join(" ")}
                  style={{ backgroundColor: color.value }}
                  onClick={() => onBackgroundChange(color.value)}
                />
              );
            })}
          </div>

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
        className="quick-editor-preview-panel quick-editor-preview-stack min-h-0 rounded-xl border border-border bg-background p-4"
      >
        <div className="quick-editor-preview-inner flex min-h-0 flex-col gap-3">
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

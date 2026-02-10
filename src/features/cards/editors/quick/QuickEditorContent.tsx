import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SideCardPreview } from "@/features/cards/components/SideCardPreview";
import type { SideOperation } from "@/features/cards/side-ir/ops";
import type { RichTextBlock, SideElement, SideIR } from "@/features/cards/side-ir/types";
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
  side: SideIR;
  richText: RichTextBlock;
  richTextBlocks: RichTextBlock[];
  mediaElements: SideElement[];
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
  return (
    <div className="quick-editor-surface-grid">
      <div className="quick-editor-input-panel space-y-4 rounded-xl border border-border bg-background p-4">
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

      <div className="quick-editor-preview-panel rounded-xl border border-border bg-background p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Live Preview
        </p>
        <div className="quick-editor-preview-stage flex items-center justify-center">
          <SideCardPreview
            side={side}
            dataTestId="quick-live-preview-card"
            className="w-full max-w-none shadow-[0_10px_20px_rgba(15,23,42,0.10)]"
          />
        </div>
      </div>
    </div>
  );
}

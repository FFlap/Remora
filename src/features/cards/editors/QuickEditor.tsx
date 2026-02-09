import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LexicalRichTextEditor } from "./LexicalRichTextEditor";
import { SideCardPreview } from "@/features/cards/components/SideCardPreview";
import type { SideOperation } from "../side-ir/ops";
import type { SideIR, SideElement, RichTextBlock } from "../side-ir/types";

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

function createDefaultRichTextElement(seed: string): RichTextBlock {
  return {
    id: `rich-${seed}`,
    type: "richText",
    lexical: {
      root: {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: "",
                type: "text",
                version: 1,
              },
            ],
            direction: null,
            format: "",
            indent: 0,
            type: "paragraph",
            version: 1,
            textFormat: 0,
            textStyle: "",
          },
        ],
        direction: null,
        format: "",
        indent: 0,
        type: "root",
        version: 1,
      },
    },
    quick: { order: 0 },
    creative: {
      x: 36,
      y: 72,
      width: 600,
      height: 260,
      rotation: 0,
    },
  };
}

function newImageElement(index: number, url: string): SideElement {
  return {
    id: `img-${Date.now()}`,
    type: "image",
    url,
    quick: { order: index },
    creative: {
      x: 36,
      y: 28,
      width: 600,
      height: 170,
      rotation: 0,
    },
  };
}

function newEmbedElement(index: number, url: string): SideElement {
  return {
    id: `embed-${Date.now()}`,
    type: "embed",
    url,
    quick: { order: index },
    creative: {
      x: 36,
      y: 224,
      width: 600,
      height: 190,
      rotation: 0,
    },
  };
}

export function QuickEditor({
  side,
  onApply,
}: {
  side: SideIR;
  onApply: (
    operations: SideOperation[],
    meta?: {
      source?: "quick" | "creative" | "system";
      batchKey?: string;
      coalesceMs?: number;
    },
  ) => void;
}) {
  const richTextBlocks = useMemo(
    () =>
      side.elements
        .filter((el): el is RichTextBlock => el.type === "richText")
        .sort((a, b) => (a.quick.order ?? 0) - (b.quick.order ?? 0)),
    [side.elements],
  );
  const [activeRichTextId, setActiveRichTextId] = useState<string | null>(richTextBlocks[0]?.id ?? null);
  const richText = useMemo(
    () => richTextBlocks.find((block) => block.id === activeRichTextId) ?? richTextBlocks[0],
    [richTextBlocks, activeRichTextId],
  );

  const mediaElements = useMemo(
    () => side.elements.filter((el) => el.type === "image" || el.type === "embed"),
    [side.elements],
  );
  const cardBackground = side.layout.creativeLayout.background ?? "#ffffff";

  useEffect(() => {
    if (richTextBlocks.length === 0) {
      setActiveRichTextId(null);
      return;
    }

    if (!activeRichTextId || !richTextBlocks.some((block) => block.id === activeRichTextId)) {
      setActiveRichTextId(richTextBlocks[0].id);
    }
  }, [richTextBlocks, activeRichTextId]);

  const handleAddTextBlock = () => {
    const next = createDefaultRichTextElement(String(Date.now()));
    next.quick.order = side.elements.length;
    setActiveRichTextId(next.id);
    onApply([{ kind: "addElement", element: next }], { source: "quick" });
  };

  const handleInsertImage = () => {
    const url = window.prompt("Image URL");
    if (!url) return;
    onApply([{ kind: "addElement", element: newImageElement(side.elements.length, url) }], {
      source: "quick",
    });
  };

  const handleBackgroundChange = (background: string) => {
    onApply(
      [{ kind: "setCreativeProjection", creativeLayout: { background } }],
      { source: "quick", batchKey: "quick-card-background", coalesceMs: 150 },
    );
  };

  if (!richText) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-700">This side does not have a text block yet.</p>
        <Button
          type="button"
          className="mt-3"
          onClick={handleAddTextBlock}
        >
          <Plus className="h-4 w-4" /> Add text block
        </Button>
      </div>
    );
  }

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
          <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={handleAddTextBlock}>
            <Plus className="h-4 w-4" />
            Add text box
          </Button>
        </div>

        <LexicalRichTextEditor
          editorKey={richText.id}
          value={richText.lexical}
          panelScrollable
          onImageInsert={handleInsertImage}
          onYouTubeInsert={() => {
            const url = window.prompt("YouTube URL");
            if (!url) return;
            onApply([{ kind: "addElement", element: newEmbedElement(side.elements.length, url) }], {
              source: "quick",
            });
          }}
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
              onChange={(event) => handleBackgroundChange(event.target.value)}
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
                onClick={() => handleBackgroundChange(color.value)}
              />
            );
          })}
        </div>

        {mediaElements.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Media Blocks</p>
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
                placeholder={element.type === "image" ? "https://image-url..." : "https://youtube-url..."}
              />
            ))}
          </div>
        )}
      </div>

      <div className="quick-editor-preview-panel rounded-xl border border-border bg-background p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Live Preview</p>
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

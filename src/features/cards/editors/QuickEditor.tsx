import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { QuickEditorContent } from "./quick/QuickEditorContent";
import type { SideOperation } from "../side-ir/ops";
import type { SideIR, SideElement, RichTextBlock } from "../side-ir/types";
import { Plus } from "lucide-react";

function normalizeHttpUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`,
    );
    return parsed.toString();
  } catch {
    return null;
  }
}

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
    const raw = window.prompt("Image URL");
    if (!raw) return;
    const url = normalizeHttpUrl(raw);
    if (!url) {
      window.alert("Enter a valid image URL.");
      return;
    }
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
    <QuickEditorContent
      side={side}
      richText={richText}
      richTextBlocks={richTextBlocks}
      mediaElements={mediaElements}
      cardBackground={cardBackground}
      setActiveRichTextId={setActiveRichTextId}
      onAddTextBlock={handleAddTextBlock}
      onInsertImage={handleInsertImage}
      onInsertYouTube={() => {
        const raw = window.prompt("YouTube URL");
        if (!raw) return;
        const url = normalizeHttpUrl(raw);
        if (!url) {
          window.alert("Enter a valid YouTube URL.");
          return;
        }
        onApply([{ kind: "addElement", element: newEmbedElement(side.elements.length, url) }], {
          source: "quick",
        });
      }}
      onBackgroundChange={handleBackgroundChange}
      onApply={onApply}
    />
  );
}

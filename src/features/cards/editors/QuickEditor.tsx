import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DEFAULT_RICHTEXT_CREATIVE_BOUNDS } from "../../../../shared/sideModelDefaults";
import type { SideOperation } from "../side-model/ops";
import type {
  EmbedBlock,
  ImageBlock,
  RichTextBlock,
  SideElement,
  SideModel,
} from "../side-model/types";
import { normalizeHttpUrl } from "./creative/lexical-utils";
import { QuickEditorContent } from "./quick/QuickEditorContent";

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
            format: "center",
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
      ...DEFAULT_RICHTEXT_CREATIVE_BOUNDS,
    },
  };
}

function newImageElement(index: number, url: string): SideElement {
  return {
    id: `img-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
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
    id: `embed-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
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

type QuickPreviewSide = {
  sideId: string;
  index: number;
  model: SideModel;
};

const quickEditedRichTextKeys = new Set<string>();

function quickEditedKey(sideKey: string, richTextId: string) {
  return `${sideKey}::${richTextId}`;
}

function normalizeQuickEditorDefaultLeftLexical(lexical: unknown) {
  if (!lexical || typeof lexical !== "object") return null;
  try {
    const clone = JSON.parse(JSON.stringify(lexical)) as {
      root?: {
        children?: Array<{
          type?: string;
          format?: unknown;
          children?: Array<{
            type?: string;
            format?: unknown;
            children?: unknown[];
          }>;
        }>;
      };
    };

    let changed = false;
    const visit = (
      nodes:
        | Array<{
            type?: string;
            format?: unknown;
            children?: Array<{
              type?: string;
              format?: unknown;
              children?: unknown[];
            }>;
          }>
        | undefined,
    ) => {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (!node) continue;
        if (
          (node.type === "paragraph" ||
            node.type === "heading" ||
            node.type === "quote") &&
          node.format === "center"
        ) {
          node.format = "";
          changed = true;
        }
        visit(node.children);
      }
    };

    visit(clone.root?.children);
    if (!changed) {
      return null;
    }

    return clone;
  } catch {
    return null;
  }
}

export function QuickEditor({
  side,
  sideKey,
  previewSides,
  activeSidePosition,
  onSelectSide,
  onApply,
}: {
  side: SideModel;
  sideKey: string;
  previewSides: QuickPreviewSide[];
  activeSidePosition: number;
  onSelectSide: (index: number) => void | Promise<void>;
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
  const [activeRichTextId, setActiveRichTextId] = useState<string | null>(
    richTextBlocks[0]?.id ?? null,
  );
  const richText = useMemo(
    () => richTextBlocks.find((block) => block.id === activeRichTextId) ?? richTextBlocks[0],
    [richTextBlocks, activeRichTextId],
  );
  const editorLexicalValue = useMemo(
    () => {
      if (!richText) return richText;
      if (quickEditedRichTextKeys.has(quickEditedKey(sideKey, richText.id))) {
        return richText.lexical;
      }
      return normalizeQuickEditorDefaultLeftLexical(richText.lexical) ?? richText.lexical;
    },
    [sideKey, richText?.id, richText?.lexical],
  );

  const mediaElements = useMemo(
    () =>
      side.elements.filter(
        (el): el is ImageBlock | EmbedBlock => el.type === "image" || el.type === "embed",
      ),
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
    onApply([{ kind: "setCreativeProjection", creativeLayout: { background } }], {
      source: "quick",
      batchKey: "quick-card-background",
      coalesceMs: 150,
    });
  };

  if (!richText) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-700">This side does not have a text block yet.</p>
        <Button type="button" className="mt-3" onClick={handleAddTextBlock}>
          <Plus className="h-4 w-4" /> Add text block
        </Button>
      </div>
    );
  }

  return (
    <QuickEditorContent
      side={side}
      previewSides={previewSides}
      activeSidePosition={activeSidePosition}
      richText={richText}
      editorLexicalValue={editorLexicalValue}
      richTextBlocks={richTextBlocks}
      mediaElements={mediaElements}
      cardBackground={cardBackground}
      setActiveRichTextId={setActiveRichTextId}
      onSelectSide={onSelectSide}
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
      onQuickEdit={(id) => {
        quickEditedRichTextKeys.add(quickEditedKey(sideKey, id));
      }}
      onApply={onApply}
    />
  );
}

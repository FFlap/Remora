import {
  DEFAULT_CREATIVE_LAYOUT,
  DEFAULT_QUICK_LAYOUT,
  DEFAULT_RICHTEXT_CREATIVE_BOUNDS,
} from "../../../../shared/sideIRDefaults";
import type {
  BaseElement,
  CreativeLayout,
  CreativeTransform,
  ElementKind,
  EmbedBlock,
  ImageBlock,
  QuickLayout,
  RichTextBlock,
  SideElement,
  SideIR,
  StrokePath,
} from "../../../../shared/sideIRTypes";

export type {
  BaseElement,
  CreativeLayout,
  CreativeTransform,
  ElementKind,
  EmbedBlock,
  ImageBlock,
  QuickLayout,
  RichTextBlock,
  SideElement,
  SideIR,
  StrokePath,
};

export function createDefaultSideIR(seed = "1"): SideIR {
  return {
    version: 1,
    elements: [
      {
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
        creative: { ...DEFAULT_RICHTEXT_CREATIVE_BOUNDS },
      },
    ],
    layout: {
      quickLayout: { ...DEFAULT_QUICK_LAYOUT },
      creativeLayout: { ...DEFAULT_CREATIVE_LAYOUT },
    },
  };
}

function asPositiveNumber(value: unknown, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function normalizeLayout(layout: unknown): SideIR["layout"] {
  const raw = (layout ?? {}) as {
    quickLayout?: Partial<QuickLayout>;
    creativeLayout?: Partial<CreativeLayout>;
  };

  const quickLayout: QuickLayout = {
    mode: "centered",
    cardRatio: asPositiveNumber(raw.quickLayout?.cardRatio, DEFAULT_QUICK_LAYOUT.cardRatio),
    previewScale: asPositiveNumber(
      raw.quickLayout?.previewScale,
      DEFAULT_QUICK_LAYOUT.previewScale,
    ),
  };

  const creativeLayout: CreativeLayout = {
    width: asPositiveNumber(raw.creativeLayout?.width, DEFAULT_CREATIVE_LAYOUT.width),
    height: asPositiveNumber(raw.creativeLayout?.height, DEFAULT_CREATIVE_LAYOUT.height),
    background:
      typeof raw.creativeLayout?.background === "string"
        ? raw.creativeLayout.background
        : DEFAULT_CREATIVE_LAYOUT.background,
    fixedViewport: true,
    padding: asPositiveNumber(raw.creativeLayout?.padding, DEFAULT_CREATIVE_LAYOUT.padding),
  };

  return { quickLayout, creativeLayout };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidCreativeTransform(value: unknown): value is CreativeTransform {
  if (!isObjectRecord(value)) return false;
  return (
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    typeof value.rotation === "number"
  );
}

function isValidElement(element: unknown): element is SideElement {
  if (!isObjectRecord(element)) return false;
  if (typeof element.id !== "string") return false;
  if (!isObjectRecord(element.quick) || typeof element.quick.order !== "number") return false;
  if (!isValidCreativeTransform(element.creative)) return false;

  switch (element.type) {
    case "richText":
      return true;
    case "image":
      return true;
    case "embed":
      return typeof element.url === "string";
    case "stroke":
      return (
        Array.isArray(element.points) &&
        isObjectRecord(element.style) &&
        typeof element.style.color === "string" &&
        typeof element.style.width === "number"
      );
    default:
      return false;
  }
}

export function asSideIR(value: unknown): SideIR {
  if (!value || typeof value !== "object") {
    return createDefaultSideIR();
  }

  const maybe = value as Partial<SideIR>;
  if (maybe.version !== 1 || !Array.isArray(maybe.elements)) {
    return createDefaultSideIR();
  }

  return {
    version: 1,
    elements: maybe.elements.filter(isValidElement),
    layout: normalizeLayout((maybe as { layout?: unknown }).layout),
  };
}

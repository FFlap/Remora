export type ElementKind = "richText" | "image" | "embed" | "stroke";

export type CreativeTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type BaseElement = {
  id: string;
  type: ElementKind;
  quick: {
    order: number;
  };
  creative: CreativeTransform;
};

export type RichTextBlock = BaseElement & {
  type: "richText";
  lexical: unknown;
};

export type ImageBlock = BaseElement & {
  type: "image";
  assetId?: string;
  url?: string;
  alt?: string;
};

export type EmbedBlock = BaseElement & {
  type: "embed";
  url: string;
};

export type StrokePath = BaseElement & {
  type: "stroke";
  points: Array<[number, number]>;
  svgPath?: string;
  baseWidth?: number;
  baseHeight?: number;
  style: {
    color: string;
    width: number;
  };
};

export type SideElement = RichTextBlock | ImageBlock | EmbedBlock | StrokePath;

export type QuickLayout = {
  mode: "centered";
  cardRatio: number;
  previewScale: number;
};

export type CreativeLayout = {
  width: number;
  height: number;
  background: string;
  fixedViewport: true;
  padding: number;
};

export type SideIR = {
  version: 1;
  elements: SideElement[];
  layout: {
    quickLayout: QuickLayout;
    creativeLayout: CreativeLayout;
  };
};

const DEFAULT_QUICK_LAYOUT: QuickLayout = {
  mode: "centered",
  cardRatio: 1.5,
  previewScale: 1,
};

const DEFAULT_CREATIVE_LAYOUT: CreativeLayout = {
  width: 760,
  height: 508,
  background: "#ffffff",
  fixedViewport: true,
  padding: 24,
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
          x: 80,
          y: 80,
          width: 500,
          height: 240,
          rotation: 0,
        },
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
    quick?: { template?: "single-column" | "split" };
    creative?: { width?: number; height?: number; background?: string };
  };

  const legacyRatio = raw.quick?.template === "split" ? 1.45 : DEFAULT_QUICK_LAYOUT.cardRatio;

  const quickLayout: QuickLayout = {
    mode: "centered",
    cardRatio: asPositiveNumber(raw.quickLayout?.cardRatio, legacyRatio),
    previewScale: asPositiveNumber(raw.quickLayout?.previewScale, DEFAULT_QUICK_LAYOUT.previewScale),
  };

  const creativeLayout: CreativeLayout = {
    width: asPositiveNumber(raw.creativeLayout?.width ?? raw.creative?.width, DEFAULT_CREATIVE_LAYOUT.width),
    height: asPositiveNumber(raw.creativeLayout?.height ?? raw.creative?.height, DEFAULT_CREATIVE_LAYOUT.height),
    background:
      typeof raw.creativeLayout?.background === "string"
        ? raw.creativeLayout.background
        : typeof raw.creative?.background === "string"
          ? raw.creative.background
          : DEFAULT_CREATIVE_LAYOUT.background,
    fixedViewport: true,
    padding: asPositiveNumber(raw.creativeLayout?.padding, DEFAULT_CREATIVE_LAYOUT.padding),
  };

  return { quickLayout, creativeLayout };
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
    elements: maybe.elements as SideElement[],
    layout: normalizeLayout((maybe as { layout?: unknown }).layout),
  };
}

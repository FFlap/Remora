import {
  DEFAULT_CREATIVE_LAYOUT,
  DEFAULT_QUICK_LAYOUT,
  DEFAULT_RICHTEXT_CREATIVE_BOUNDS,
} from "../../shared/sideIRDefaults";

export type SideIR = {
  version: 1;
  elements: Array<{
    id: string;
    type: "richText" | "image" | "embed" | "stroke";
    quick: {
      order: number;
    };
    creative: {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
    };
    lexical?: unknown;
    assetId?: string;
    url?: string;
    alt?: string;
    points?: number[][];
    svgPath?: string;
    baseWidth?: number;
    baseHeight?: number;
    style?: {
      color: string;
      width: number;
    };
  }>;
  layout: {
    quickLayout: {
      mode: "centered";
      cardRatio: number;
      previewScale: number;
    };
    creativeLayout: {
      width: number;
      height: number;
      background: string;
      fixedViewport: true;
      padding: number;
    };
  };
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
        quick: {
          order: 0,
        },
        creative: {
          ...DEFAULT_RICHTEXT_CREATIVE_BOUNDS,
        },
      },
    ],
    layout: {
      quickLayout: { ...DEFAULT_QUICK_LAYOUT },
      creativeLayout: { ...DEFAULT_CREATIVE_LAYOUT },
    },
  };
}

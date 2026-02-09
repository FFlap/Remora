export type SideIR = {
  version: 1;
  elements: Array<Record<string, unknown>>;
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
          x: 64,
          y: 64,
          width: 520,
          height: 280,
          rotation: 0,
        },
      },
    ],
    layout: {
      quickLayout: { mode: "centered", cardRatio: 1.5, previewScale: 1 },
      creativeLayout: {
        width: 672,
        height: 448,
        background: "#ffffff",
        fixedViewport: true,
        padding: 24,
      },
    },
  };
}

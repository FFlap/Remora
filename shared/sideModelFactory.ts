import {
  DEFAULT_CREATIVE_LAYOUT,
  DEFAULT_QUICK_LAYOUT,
  DEFAULT_RICHTEXT_CREATIVE_BOUNDS,
} from "./sideModelDefaults";
import type { SideModel } from "./sideModelTypes";

export function createDefaultSideModel(seed = "1"): SideModel {
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

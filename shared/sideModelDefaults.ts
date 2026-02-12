export const DEFAULT_QUICK_LAYOUT = {
  mode: "centered" as const,
  cardRatio: 1.5,
  previewScale: 1,
};

export const DEFAULT_CREATIVE_LAYOUT = {
  width: 760,
  height: 508,
  background: "#ffffff",
  fixedViewport: true as const,
  padding: 24,
};

const DEFAULT_RICHTEXT_INSET_X = Math.floor(DEFAULT_CREATIVE_LAYOUT.width * 0.05);
const DEFAULT_RICHTEXT_INSET_Y = Math.floor(DEFAULT_CREATIVE_LAYOUT.height * 0.05);

export const DEFAULT_RICHTEXT_CREATIVE_BOUNDS = {
  x: DEFAULT_RICHTEXT_INSET_X,
  y: DEFAULT_RICHTEXT_INSET_Y,
  width: DEFAULT_CREATIVE_LAYOUT.width - DEFAULT_RICHTEXT_INSET_X * 2,
  height: DEFAULT_CREATIVE_LAYOUT.height - DEFAULT_RICHTEXT_INSET_Y * 2,
  rotation: 0,
};

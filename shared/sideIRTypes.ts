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

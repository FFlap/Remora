import type { ActiveSelection, FabricObject } from "fabric";

export type ToolMode = "select" | "draw" | "erase";
export type OrderDirection = "forward" | "backward";

export type CreativeContextMenuState = {
  x: number;
  y: number;
  elementId: string;
  kind?: string;
};

export type CanvasObjectMetadata = {
  kind?: string;
  elementId?: string;
};

export type CanvasObject = FabricObject & {
  data?: CanvasObjectMetadata;
  __originalStroke?: string | null;
};

export type CreativeTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type ActiveSelectionSnapshot = {
  bounds: { left: number; top: number; width: number; height: number };
  entries: Array<{
    elementId: string;
    kind?: string;
    creative: CreativeTransform;
  }>;
};

export type TransformTarget = {
  object: CanvasObject;
  metadata: { kind?: string; elementId: string };
};

export type ActiveSelectionTarget = {
  getObjects: () => CanvasObject[];
} & ActiveSelection;

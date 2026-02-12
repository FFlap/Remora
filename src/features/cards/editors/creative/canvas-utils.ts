import type { ActiveSelection, Path } from "fabric";
import { util } from "fabric";
import type { SideElement, StrokePath } from "@/features/cards/side-model/types";
import {
  INSIGHT_SELECTION_COLOR,
  INSIGHT_SELECTION_FILL,
  INSIGHT_SELECTION_HANDLE_SIZE,
} from "./constants";
import type {
  ActiveSelectionSnapshot,
  ActiveSelectionTarget,
  CanvasObject,
  CreativeTransform,
  TransformTarget,
} from "./types";

type StrokeGeometry = {
  points: Array<[number, number]>;
  minX: number;
  minY: number;
  width: number;
  height: number;
};

export function applyInsightSelectionStyle(target: unknown) {
  if (!target || typeof target !== "object") return;
  const targetWithSetter = target as {
    set?: (props: Record<string, unknown>) => void;
  };
  targetWithSetter.set?.({
    borderColor: INSIGHT_SELECTION_COLOR,
    borderDashArray: undefined,
    borderScaleFactor: 2,
    borderOpacityWhenMoving: 1,
    cornerColor: INSIGHT_SELECTION_COLOR,
    cornerStrokeColor: INSIGHT_SELECTION_COLOR,
    cornerStyle: "circle",
    cornerSize: INSIGHT_SELECTION_HANDLE_SIZE,
    transparentCorners: false,
    padding: 1,
    selectionBackgroundColor: INSIGHT_SELECTION_FILL,
  });
}

export function pointsToPath(points: Array<[number, number]>) {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M ${first[0]} ${first[1]} ${rest.map((point) => `L ${point[0]} ${point[1]}`).join(" ")}`;
}

function pathCommandsToPathString(pathData: unknown): string {
  if (!Array.isArray(pathData)) return "";
  return pathData
    .map((command) => {
      if (!Array.isArray(command) || command.length === 0) return "";
      return command
        .map((token) =>
          typeof token === "number" && Number.isFinite(token) ? Number(token.toFixed(4)) : token,
        )
        .join(" ");
    })
    .filter(Boolean)
    .join(" ");
}

function normalizePathCommands(
  pathData: unknown,
  offsetX: number,
  offsetY: number,
  scaleX = 1,
  scaleY = 1,
): unknown {
  if (!Array.isArray(pathData)) return pathData;
  return pathData.map((command) => {
    if (!Array.isArray(command) || command.length < 2) return command;
    const [head, ...tail] = command;
    const normalizedTail = tail.map((value, index) => {
      if (typeof value !== "number" || !Number.isFinite(value)) return value;
      return index % 2 === 0 ? (value - offsetX) * scaleX : (value - offsetY) * scaleY;
    });
    return [head, ...normalizedTail];
  });
}

function commandToPoints(command: unknown) {
  if (!Array.isArray(command) || command.length < 3) {
    return [] as Array<[number, number]>;
  }

  const points: Array<[number, number]> = [];
  for (let index = 1; index < command.length - 1; index += 2) {
    const x = Number(command[index]);
    const y = Number(command[index + 1]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push([x, y]);
    }
  }
  return points;
}

function pathDataToPoints(pathData: unknown): Array<[number, number]> {
  if (!Array.isArray(pathData)) return [];
  return pathData.flatMap(commandToPoints);
}

function getStrokeGeometry(points: Array<[number, number]>): StrokeGeometry {
  if (points.length === 0) {
    return {
      points,
      minX: 0,
      minY: 0,
      width: 1,
      height: 1,
    };
  }

  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    points,
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function normalizeStrokeForFabric(element: StrokePath) {
  const geometry = getStrokeGeometry(element.points);
  const looksNormalized = Math.abs(geometry.minX) <= 1 && Math.abs(geometry.minY) <= 1;

  const normalizedPoints = looksNormalized
    ? geometry.points
    : geometry.points.map(([x, y]) => [x - geometry.minX, y - geometry.minY] as [number, number]);

  const inferredBaseWidth = Math.max(1, getStrokeGeometry(normalizedPoints).width);
  const inferredBaseHeight = Math.max(1, getStrokeGeometry(normalizedPoints).height);
  const baseWidth = Math.max(1, element.baseWidth ?? inferredBaseWidth);
  const baseHeight = Math.max(1, element.baseHeight ?? inferredBaseHeight);

  return {
    left: element.creative.x,
    top: element.creative.y,
    points: normalizedPoints,
    baseWidth,
    baseHeight,
  };
}

export function elementTransformFromObject(object: CanvasObject): CreativeTransform {
  const topLeft = object.getPointByOrigin?.("left", "top") ?? null;
  const width = Math.abs((object.width ?? 0) * (object.scaleX ?? 1));
  const height = Math.abs((object.height ?? 0) * (object.scaleY ?? 1));
  return {
    x: topLeft?.x ?? object.left ?? 0,
    y: topLeft?.y ?? object.top ?? 0,
    width: Math.max(1, width),
    height: Math.max(1, height),
    rotation: object.angle ?? 0,
  };
}

export function isSizeChangingTransformAction(action: unknown) {
  if (typeof action !== "string") return false;
  const normalized = action.toLowerCase();
  return (
    normalized.includes("scale") || normalized.includes("resize") || normalized.includes("skew")
  );
}

export function isActiveSelectionTarget(target: unknown): target is ActiveSelectionTarget {
  if (!target || typeof target !== "object") return false;
  const maybe = target as { getObjects?: () => CanvasObject[] };
  if (typeof maybe.getObjects !== "function") return false;
  const objects = maybe.getObjects();
  return Array.isArray(objects) && objects.length > 1;
}

export function collectTransformTargets(target: unknown): TransformTarget[] {
  if (!target || typeof target !== "object") return [];

  const asTransformTarget = (object: unknown): TransformTarget | null => {
    if (!object || typeof object !== "object") return null;
    const canvasObject = object as CanvasObject;
    const metadata = canvasObject.data;
    if (!metadata?.elementId) return null;
    return {
      object: canvasObject,
      metadata: {
        kind: typeof metadata.kind === "string" ? metadata.kind : undefined,
        elementId: String(metadata.elementId),
      },
    };
  };

  const direct = asTransformTarget(target);
  if (direct) {
    return [direct];
  }

  if (isActiveSelectionTarget(target)) {
    return target
      .getObjects()
      .map(asTransformTarget)
      .filter((entry): entry is TransformTarget => entry !== null);
  }

  return [];
}

export function getObjectBounds(object: CanvasObject | ActiveSelection | null) {
  if (!object) return null;
  object.setCoords?.();
  if (typeof object.getBoundingRect !== "function") return null;
  return object.getBoundingRect(true, true);
}

export function clampCreativeTransform(
  creative: CreativeTransform,
  maxWidth: number,
  maxHeight: number,
): CreativeTransform {
  const width = Math.max(1, creative.width);
  const height = Math.max(1, creative.height);
  const clampedX = Math.min(Math.max(0, creative.x), Math.max(0, maxWidth - width));
  const clampedY = Math.min(Math.max(0, creative.y), Math.max(0, maxHeight - height));
  return {
    ...creative,
    x: clampedX,
    y: clampedY,
    width,
    height,
  };
}

function toCreativeTransform(value: SideElement["creative"]): CreativeTransform {
  return {
    x: value.x,
    y: value.y,
    width: Math.max(1, value.width),
    height: Math.max(1, value.height),
    rotation: value.rotation ?? 0,
  };
}

export function buildActiveSelectionSnapshot(
  target: unknown,
  elements: SideElement[],
): ActiveSelectionSnapshot | null {
  if (!isActiveSelectionTarget(target)) {
    return null;
  }
  const bounds = getObjectBounds(target);
  if (!bounds) return null;

  const elementById = new Map(elements.map((element) => [element.id, element] as const));
  const entries = target.getObjects().reduce<ActiveSelectionSnapshot["entries"]>((acc, object) => {
    const metadata = object?.data;
    const elementId = metadata?.elementId ? String(metadata.elementId) : null;
    if (!elementId) return acc;
    const element = elementById.get(elementId);
    if (!element) return acc;
    acc.push({
      elementId,
      kind: typeof metadata?.kind === "string" ? metadata.kind : undefined,
      creative: toCreativeTransform(element.creative),
    });
    return acc;
  }, []);

  if (entries.length === 0) return null;
  return {
    bounds: {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    },
    entries,
  };
}

export function strokeFromFabricPath(path: Path) {
  const transformed = util.transformPath(path.path, path.calcTransformMatrix(), path.pathOffset);
  const absolutePoints = pathDataToPoints(transformed);
  if (absolutePoints.length === 0) {
    const fallback = getStrokeGeometry(pathDataToPoints(path.path));
    const targetWidth = Math.max(1, fallback.width);
    const targetHeight = Math.max(1, fallback.height);
    const normalizedFallbackPoints = fallback.points.map(
      ([x, y]) => [x - fallback.minX, y - fallback.minY] as [number, number],
    );
    return {
      points: normalizedFallbackPoints,
      svgPath: pointsToPath(normalizedFallbackPoints),
      baseWidth: targetWidth,
      baseHeight: targetHeight,
      creative: {
        x: fallback.minX,
        y: fallback.minY,
        width: targetWidth,
        height: targetHeight,
        rotation: 0,
      },
    };
  }

  const geometry = getStrokeGeometry(absolutePoints);
  const originX = geometry.minX;
  const originY = geometry.minY;
  const targetWidth = Math.max(1, geometry.width);
  const targetHeight = Math.max(1, geometry.height);
  const normalizedPoints = absolutePoints.map(
    ([x, y]) => [x - originX, y - originY] as [number, number],
  );
  const normalizedCommands = normalizePathCommands(transformed, originX, originY, 1, 1);

  return {
    points: normalizedPoints,
    svgPath: pathCommandsToPathString(normalizedCommands),
    baseWidth: targetWidth,
    baseHeight: targetHeight,
    creative: {
      x: originX,
      y: originY,
      width: targetWidth,
      height: targetHeight,
      rotation: 0,
    },
  };
}

export function constrainObjectToCardBounds(
  object: CanvasObject | ActiveSelection | null,
  maxWidth: number,
  maxHeight: number,
) {
  if (!object) return false;

  const readBounds = () => {
    if (typeof object.getBoundingRect !== "function") return null;
    return object.getBoundingRect(true, true);
  };

  const applyScaleToFitBounds = (bounds: ReturnType<typeof readBounds>) => {
    if (!bounds) return false;
    if (bounds.width <= maxWidth && bounds.height <= maxHeight) return false;
    const ratio = Math.min(maxWidth / bounds.width, maxHeight / bounds.height, 1);
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) return false;
    object.scaleX = Math.max(0.01, (object.scaleX ?? 1) * ratio);
    object.scaleY = Math.max(0.01, (object.scaleY ?? 1) * ratio);
    return true;
  };

  const computePositionDelta = (bounds: NonNullable<ReturnType<typeof readBounds>>) => {
    let deltaX = 0;
    let deltaY = 0;

    if (bounds.left < 0) {
      deltaX = -bounds.left;
    } else if (bounds.left + bounds.width > maxWidth) {
      deltaX = maxWidth - (bounds.left + bounds.width);
    }

    if (bounds.top < 0) {
      deltaY = -bounds.top;
    } else if (bounds.top + bounds.height > maxHeight) {
      deltaY = maxHeight - (bounds.top + bounds.height);
    }

    return { deltaX, deltaY };
  };

  object.setCoords?.();
  let bounds = readBounds();
  if (!bounds) return false;

  let changed = false;
  const scaled = applyScaleToFitBounds(bounds);
  if (scaled) {
    changed = true;
    object.setCoords?.();
    bounds = readBounds();
    if (!bounds) return changed;
  }

  const { deltaX, deltaY } = computePositionDelta(bounds);

  if (deltaX !== 0 || deltaY !== 0) {
    object.set({
      left: (object.left ?? 0) + deltaX,
      top: (object.top ?? 0) + deltaY,
    });
    changed = true;
  }

  if (changed) {
    object.setCoords?.();
  }

  return changed;
}

export function constrainObjectPositionToCardBounds(
  object: CanvasObject | ActiveSelection | null,
  maxWidth: number,
  maxHeight: number,
) {
  if (!object) return false;
  object.setCoords?.();
  const bounds =
    typeof object.getBoundingRect === "function" ? object.getBoundingRect(true, true) : null;
  if (!bounds) return false;

  let deltaX = 0;
  let deltaY = 0;

  if (bounds.left < 0) {
    deltaX = -bounds.left;
  } else if (bounds.left + bounds.width > maxWidth) {
    deltaX = maxWidth - (bounds.left + bounds.width);
  }

  if (bounds.top < 0) {
    deltaY = -bounds.top;
  } else if (bounds.top + bounds.height > maxHeight) {
    deltaY = maxHeight - (bounds.top + bounds.height);
  }

  if (deltaX !== 0 || deltaY !== 0) {
    object.set({
      left: (object.left ?? 0) + deltaX,
      top: (object.top ?? 0) + deltaY,
    });
    object.setCoords?.();
    return true;
  }

  return false;
}

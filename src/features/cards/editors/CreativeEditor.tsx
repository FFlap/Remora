import { useEffect, useMemo, useRef, useState } from "react";
import { ActiveSelection, Canvas, FabricImage, Path, PencilBrush, Rect, util } from "fabric";
import { AlignCenter, Eraser, ImagePlus, Link2, List, ListOrdered, Minus, MousePointer2, PenLine, Plus, Trash2, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LexicalRichTextView } from "@/features/cards/components/LexicalRichTextView";
import { LexicalRichTextEditor } from "./LexicalRichTextEditor";
import type { SideOperation } from "../side-ir/ops";
import type { RichTextBlock, SideIR, SideElement, StrokePath } from "../side-ir/types";

type ToolMode = "select" | "draw" | "erase";
type OrderDirection = "forward" | "backward";

type CreativeContextMenuState = {
  x: number;
  y: number;
  elementId: string;
  kind?: string;
};

type StrokeGeometry = {
  points: Array<[number, number]>;
  minX: number;
  minY: number;
  width: number;
  height: number;
};

const TEXT_FORMAT_BITS = {
  bold: 1,
  italic: 2,
  strikethrough: 4,
  underline: 8,
} as const;

const INSIGHT_SELECTION_COLOR = "#3b82f6";
const INSIGHT_SELECTION_FILL = "rgba(59, 130, 246, 0.16)";
const INSIGHT_SELECTION_HANDLE_SIZE = 8;
const RICH_TEXT_MIN_WIDTH = 10;
const RICH_TEXT_MIN_HEIGHT = 20;
const DRAW_COLOR_SWATCHES = ["#000000", "#ef4444", "#3b82f6", "#22c55e", "#f97316", "#8b5cf6"];
const LEGACY_CREATIVE_WIDTH = 672;
const LEGACY_CREATIVE_HEIGHT = 448;
const UPSIZED_CREATIVE_WIDTH = 760;
const UPSIZED_CREATIVE_HEIGHT = 508;

function applyInsightSelectionStyle(target: any) {
  if (!target?.set) return;
  target.set({
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

function createDefaultLexicalState() {
  return {
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
  };
}

function createRichTextElement(seed: string, order: number): RichTextBlock {
  return {
    id: `rich-${seed}`,
    type: "richText",
    lexical: createDefaultLexicalState(),
    quick: { order },
    creative: {
      x: 84,
      y: 96,
      width: 460,
      height: 180,
      rotation: 0,
    },
  };
}

function pointsToPath(points: Array<[number, number]>) {
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
        .map((token) => (typeof token === "number" && Number.isFinite(token) ? Number(token.toFixed(4)) : token))
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

function normalizeStrokeForFabric(element: StrokePath) {
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

function elementTransformFromObject(object: any) {
  const topLeft =
    typeof object.getPointByOrigin === "function"
      ? object.getPointByOrigin("left", "top")
      : null;
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

function isSizeChangingTransformAction(action: unknown) {
  if (typeof action !== "string") return false;
  const normalized = action.toLowerCase();
  return normalized.includes("scale") || normalized.includes("resize") || normalized.includes("skew");
}

type TransformTarget = {
  object: any;
  metadata: { kind?: string; elementId: string };
};

function isActiveSelectionTarget(target: any) {
  if (!target || typeof target.getObjects !== "function") return false;
  const objects = target.getObjects();
  return Array.isArray(objects) && objects.length > 1;
}

function collectTransformTargets(target: any): TransformTarget[] {
  if (!target) return [];

  const asTransformTarget = (object: any): TransformTarget | null => {
    const metadata = object?.data;
    if (!metadata?.elementId) return null;
    return {
      object,
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
    return (target.getObjects() as any[])
      .map(asTransformTarget)
      .filter((entry): entry is TransformTarget => entry !== null);
  }

  return [];
}

function getObjectBounds(object: any) {
  if (!object) return null;
  object.setCoords?.();
  if (typeof object.getBoundingRect !== "function") return null;
  return object.getBoundingRect(true, true);
}

type CreativeTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

function clampCreativeTransform(creative: CreativeTransform, maxWidth: number, maxHeight: number): CreativeTransform {
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

type ActiveSelectionSnapshot = {
  bounds: { left: number; top: number; width: number; height: number };
  entries: Array<{
    elementId: string;
    kind?: string;
    creative: CreativeTransform;
  }>;
};

function toCreativeTransform(value: SideElement["creative"]): CreativeTransform {
  return {
    x: value.x,
    y: value.y,
    width: Math.max(1, value.width),
    height: Math.max(1, value.height),
    rotation: value.rotation ?? 0,
  };
}

function buildActiveSelectionSnapshot(target: any, elements: SideElement[]): ActiveSelectionSnapshot | null {
  if (!isActiveSelectionTarget(target)) {
    return null;
  }
  const bounds = getObjectBounds(target);
  if (!bounds) return null;

  const elementById = new Map(elements.map((element) => [element.id, element] as const));
  const entries = (target.getObjects() as any[])
    .map((object) => {
      const metadata = object?.data;
      const elementId = metadata?.elementId ? String(metadata.elementId) : null;
      if (!elementId) return null;
      const element = elementById.get(elementId);
      if (!element) return null;
      return {
        elementId,
        kind: typeof metadata?.kind === "string" ? metadata.kind : undefined,
        creative: toCreativeTransform(element.creative),
      };
    })
    .filter(
      (
        value,
      ): value is { elementId: string; kind?: string; creative: CreativeTransform } => value !== null,
    );

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

function strokeFromFabricPath(path: any) {
  const transformed = util.transformPath(path.path, path.calcTransformMatrix(), path.pathOffset);
  const absolutePoints = pathDataToPoints(transformed);
  if (absolutePoints.length === 0) {
    const fallback = getStrokeGeometry(pathDataToPoints(path.path));
    const targetWidth = Math.max(1, fallback.width);
    const targetHeight = Math.max(1, fallback.height);
    return {
      points: fallback.points.map(
        ([x, y]) => [x - fallback.minX, y - fallback.minY] as [number, number],
      ),
      svgPath: pointsToPath(
        fallback.points.map(([x, y]) => [x - fallback.minX, y - fallback.minY] as [number, number]),
      ),
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

function constrainObjectToCardBounds(object: any, maxWidth: number, maxHeight: number) {
  if (!object) return false;

  const readBounds = () =>
    typeof object.getBoundingRect === "function"
      ? object.getBoundingRect(true, true)
      : null;

  object.setCoords?.();
  let bounds = readBounds();
  if (!bounds) return false;

  let changed = false;

  if (bounds.width > maxWidth || bounds.height > maxHeight) {
    const ratio = Math.min(maxWidth / bounds.width, maxHeight / bounds.height, 1);
    if (Number.isFinite(ratio) && ratio > 0 && ratio < 1) {
      object.scaleX = Math.max(0.01, (object.scaleX ?? 1) * ratio);
      object.scaleY = Math.max(0.01, (object.scaleY ?? 1) * ratio);
      changed = true;
      object.setCoords?.();
      bounds = readBounds();
      if (!bounds) return changed;
    }
  }

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
    changed = true;
  }

  if (changed) {
    object.setCoords?.();
  }

  return changed;
}

function constrainObjectPositionToCardBounds(object: any, maxWidth: number, maxHeight: number) {
  if (!object) return false;
  object.setCoords?.();
  const bounds =
    typeof object.getBoundingRect === "function"
      ? object.getBoundingRect(true, true)
      : null;
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

type LexicalTextNode = {
  type?: string;
  text?: string;
  url?: string;
  listType?: "bullet" | "number";
  tag?: string;
  format?: number | string;
  style?: string;
  children?: LexicalTextNode[];
};

function cloneLexicalState(value: unknown) {
  try {
    return JSON.parse(JSON.stringify(value ?? createDefaultLexicalState())) as {
      root?: { children?: LexicalTextNode[] };
    };
  } catch {
    return createDefaultLexicalState() as { root?: { children?: LexicalTextNode[] } };
  }
}

function walkTextNodes(nodes: LexicalTextNode[] | undefined, visitor: (node: LexicalTextNode) => void) {
  if (!Array.isArray(nodes)) return;
  for (const node of nodes) {
    if (node?.type === "text") {
      visitor(node);
    }
    if (Array.isArray(node?.children)) {
      walkTextNodes(node.children, visitor);
    }
  }
}

function normalizeTextFormat(format: unknown) {
  const numeric = typeof format === "number" ? format : Number.parseInt(String(format ?? 0), 10);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseStyleMap(style: string | undefined) {
  const map = new Map<string, string>();
  if (!style) return map;
  for (const part of style.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [rawKey, ...rawValue] = trimmed.split(":");
    const key = rawKey?.trim().toLowerCase();
    const value = rawValue.join(":").trim();
    if (!key || !value) continue;
    map.set(key, value);
  }
  return map;
}

function styleMapToString(styleMap: Map<string, string>) {
  const parts = [...styleMap.entries()].map(([key, value]) => `${key}: ${value}`);
  return parts.join("; ");
}

function getFirstTextStyleProperty(lexical: unknown, property: string) {
  const clone = cloneLexicalState(lexical);
  let found: string | null = null;
  walkTextNodes(clone.root?.children, (node) => {
    if (found) return;
    const value = parseStyleMap(node.style).get(property);
    if (value) {
      found = value;
    }
  });
  return found;
}

function hasAnyTextFormatBit(lexical: unknown, bit: number) {
  const clone = cloneLexicalState(lexical);
  let hasBit = false;
  walkTextNodes(clone.root?.children, (node) => {
    if (hasBit) return;
    const format = normalizeTextFormat(node.format);
    hasBit = (format & bit) !== 0;
  });
  return hasBit;
}

function toggleTextFormatBitOnAll(lexical: unknown, bit: number) {
  const clone = cloneLexicalState(lexical);
  let nodeCount = 0;
  let formattedCount = 0;

  walkTextNodes(clone.root?.children, (node) => {
    nodeCount += 1;
    const format = normalizeTextFormat(node.format);
    if ((format & bit) !== 0) {
      formattedCount += 1;
    }
  });

  const shouldEnable = nodeCount === 0 ? true : formattedCount !== nodeCount;

  walkTextNodes(clone.root?.children, (node) => {
    const format = normalizeTextFormat(node.format);
    node.format = shouldEnable ? format | bit : format & ~bit;
  });

  return clone;
}

function setTextStylePropertyOnAll(lexical: unknown, property: string, value: string) {
  const clone = cloneLexicalState(lexical);
  walkTextNodes(clone.root?.children, (node) => {
    const styleMap = parseStyleMap(node.style);
    styleMap.set(property, value);
    node.style = styleMapToString(styleMap);
  });
  return clone;
}

function buildCreativeCanvasSignature(side: SideIR) {
  return JSON.stringify({
    layout: {
      width: side.layout.creativeLayout.width,
      height: side.layout.creativeLayout.height,
      background: side.layout.creativeLayout.background,
      padding: side.layout.creativeLayout.padding,
    },
    elements: side.elements.map((element) => {
      const shared = {
        id: element.id,
        type: element.type,
        quickOrder: element.quick.order ?? 0,
        creative: {
          x: element.creative.x,
          y: element.creative.y,
          width: element.creative.width,
          height: element.creative.height,
          rotation: element.creative.rotation ?? 0,
        },
      };

      if (element.type === "stroke") {
        return {
          ...shared,
          points: element.points,
          svgPath: element.svgPath ?? null,
          baseWidth: element.baseWidth ?? null,
          baseHeight: element.baseHeight ?? null,
          style: element.style,
        };
      }

      if (element.type === "image") {
        return {
          ...shared,
          url: element.url ?? null,
          assetId: element.assetId ?? null,
        };
      }

      if (element.type === "embed") {
        return {
          ...shared,
          url: element.url,
        };
      }

      return shared;
    }),
  });
}

function normalizeHttpUrl(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  const prefixed = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(prefixed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function getFirstLinkUrl(lexical: unknown) {
  const clone = cloneLexicalState(lexical);
  let found: string | null = null;
  const visit = (nodes: LexicalTextNode[] | undefined) => {
    if (!Array.isArray(nodes) || found) return;
    for (const node of nodes) {
      if (found) break;
      if (node?.type === "link" && typeof node.url === "string" && node.url.length > 0) {
        found = node.url;
        break;
      }
      visit(node?.children);
    }
  };
  visit(clone.root?.children);
  return found;
}

function toggleListTypeOnRoot(lexical: unknown, listType: "bullet" | "number") {
  const clone = cloneLexicalState(lexical);
  const rootChildren = clone.root?.children;
  if (!Array.isArray(rootChildren) || rootChildren.length === 0) return clone;

  if (rootChildren.length === 1 && rootChildren[0]?.type === "list") {
    const existing = rootChildren[0];
    if (existing.listType === listType) {
      const unwrapped = (existing.children ?? [])
        .map((child) => {
          if (child?.type === "listitem" && Array.isArray(child.children) && child.children.length > 0) {
            return child.children[0];
          }
          return null;
        })
        .filter((node): node is LexicalTextNode => node !== null);
      clone.root = {
        ...clone.root,
        children: unwrapped.length > 0 ? unwrapped : rootChildren,
      };
      return clone;
    }

    const updatedList: LexicalTextNode = {
      ...existing,
      listType,
      tag: listType === "number" ? "ol" : "ul",
    };
    clone.root = {
      ...clone.root,
      children: [updatedList],
    };
    return clone;
  }

  const wrappedList: LexicalTextNode = {
    type: "list",
    listType,
    tag: listType === "number" ? "ol" : "ul",
    children: rootChildren.map((node, index) => ({
      type: "listitem",
      value: index + 1,
      children: [node],
    })),
  };

  clone.root = {
    ...clone.root,
    children: [wrappedList],
  };
  return clone;
}

function hasRootListType(lexical: unknown, listType: "bullet" | "number") {
  const rootChildren = cloneLexicalState(lexical).root?.children;
  return Array.isArray(rootChildren) && rootChildren.length === 1 && rootChildren[0]?.type === "list" && rootChildren[0]?.listType === listType;
}

function setBlockAlignmentOnAll(lexical: unknown, align: "left" | "center" | "right" | "justify") {
  const clone = cloneLexicalState(lexical);
  const visit = (nodes: LexicalTextNode[] | undefined) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (node?.type === "paragraph" || node?.type === "heading" || node?.type === "quote") {
        node.format = align;
      }
      visit(node?.children);
    }
  };
  visit(clone.root?.children);
  return clone;
}

function isCenterAligned(lexical: unknown) {
  const clone = cloneLexicalState(lexical);
  let hasBlocks = false;
  let allCentered = true;
  const visit = (nodes: LexicalTextNode[] | undefined) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (node?.type === "paragraph" || node?.type === "heading" || node?.type === "quote") {
        hasBlocks = true;
        if (node.format !== "center") {
          allCentered = false;
        }
      }
      visit(node?.children);
    }
  };
  visit(clone.root?.children);
  return hasBlocks && allCentered;
}

function setLinkOnAllBlocks(lexical: unknown, url: string | null) {
  const clone = cloneLexicalState(lexical);

  const stripLinks = (nodes: LexicalTextNode[] | undefined): LexicalTextNode[] => {
    if (!Array.isArray(nodes)) return [];
    return nodes.flatMap((node) => {
      if (!node) return [];
      if (node.type === "link") {
        return stripLinks(node.children);
      }
      if (Array.isArray(node.children)) {
        return [{ ...node, children: stripLinks(node.children) }];
      }
      return [node];
    });
  };

  const wrapBlocks = (nodes: LexicalTextNode[] | undefined): LexicalTextNode[] => {
    if (!Array.isArray(nodes)) return [];
    return nodes.map((node) => {
      if (!node) return node;
      const nextChildren = Array.isArray(node.children) ? wrapBlocks(node.children) : node.children;
      if (node.type === "paragraph" || node.type === "heading" || node.type === "quote" || node.type === "listitem") {
        const blockChildren = stripLinks(nextChildren);
        if (!url || blockChildren.length === 0) {
          return {
            ...node,
            children: blockChildren,
          };
        }
        return {
          ...node,
          children: [
            {
              type: "link",
              url,
              children: blockChildren,
            },
          ],
        };
      }
      return {
        ...node,
        children: nextChildren,
      };
    });
  };

  clone.root = {
    ...clone.root,
    children: wrapBlocks(clone.root?.children),
  };

  return clone;
}

export function CreativeEditor({
  side,
  onApply,
}: {
  side: SideIR;
  onApply: (
    operations: SideOperation[],
    meta?: {
      source?: "quick" | "creative" | "system";
      batchKey?: string;
      coalesceMs?: number;
    },
  ) => void;
}) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const stageViewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const hoveredStrokeRef = useRef<any>(null);
  const skipNextCanvasHydrationRef = useRef(false);
  const isHydratingCanvasRef = useRef(false);
  const activeSelectionSnapshotRef = useRef<ActiveSelectionSnapshot | null>(null);
  const pendingSelectionElementIdsRef = useRef<string[] | null>(null);
  const suppressNextSelectionClearedRef = useRef(false);
  const suppressSelectionClearedUntilRef = useRef(0);

  const [tool, setTool] = useState<ToolMode>("select");
  const [strokeColor, setStrokeColor] = useState("#0f172a");
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const selectedElementIdRef = useRef<string | null>(null);
  const [editingRichTextId, setEditingRichTextId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<CreativeContextMenuState | null>(null);
  const [liveRichTextTransforms, setLiveRichTextTransforms] = useState<
    Record<string, { x: number; y: number; width: number; height: number; rotation: number }>
  >({});
  const [stageScale, setStageScale] = useState(1);

  const canvasSignature = useMemo(() => buildCreativeCanvasSignature(side), [side]);
  const cardWidth = side.layout.creativeLayout.width;
  const cardHeight = side.layout.creativeLayout.height;
  const cardOuterWidth = cardWidth + 12;
  const cardOuterHeight = cardHeight + 12;
  const selectedElement = useMemo(
    () => side.elements.find((element) => element.id === selectedElementId) ?? null,
    [side.elements, selectedElementId],
  );
  useEffect(() => {
    selectedElementIdRef.current = selectedElementId;
  }, [selectedElementId]);
  const contextMenuElement = useMemo(
    () => side.elements.find((element) => element.id === contextMenu?.elementId) ?? null,
    [contextMenu, side.elements],
  );
  const selectedRichText = selectedElement?.type === "richText" ? selectedElement : null;
  const richTextElements = useMemo(
    () =>
      side.elements
        .filter((element): element is RichTextBlock => element.type === "richText")
        .sort((a, b) => (a.quick.order ?? 0) - (b.quick.order ?? 0)),
    [side.elements],
  );
  const editingRichText = useMemo(
    () =>
      side.elements.find(
        (element): element is RichTextBlock => element.id === editingRichTextId && element.type === "richText",
      ) ?? null,
    [editingRichTextId, side.elements],
  );
  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const deleteElementById = (elementId: string) => {
    if (editingRichTextId === elementId) {
      setEditingRichTextId(null);
    }
    onApply([{ kind: "removeElement", elementId }], {
      source: "creative",
      batchKey: `context-delete-${elementId}`,
    });
    closeContextMenu();
  };

  const moveElementOrder = (elementId: string, direction: OrderDirection) => {
    const sorted = [...side.elements].sort((a, b) => (a.quick.order ?? 0) - (b.quick.order ?? 0));
    const index = sorted.findIndex((element) => element.id === elementId);
    if (index < 0) return;

    const moved = sorted[index];
    const remaining = sorted.filter((element) => element.id !== elementId);
    const reordered = direction === "forward" ? [...remaining, moved] : [moved, ...remaining];

    const operations: Array<Extract<SideOperation, { kind: "updateElement" }>> = reordered
      .map((element, order) => ({ element, order }))
      .filter(({ element, order }) => (element.quick.order ?? 0) !== order)
      .map(({ element, order }) => ({
        kind: "updateElement",
        elementId: element.id,
        patch: {
          quick: {
            ...element.quick,
            order,
          },
        } as Partial<SideElement>,
      }));

    if (operations.length > 0) {
      onApply(operations, {
        source: "creative",
        batchKey: `context-order-${direction}-${elementId}`,
      });
    }
    closeContextMenu();
  };

  useEffect(() => {
    if (!canvasElRef.current) return;

    const canvas = new Canvas(canvasElRef.current, {
      width: cardWidth,
      height: cardHeight,
      backgroundColor: "rgba(0, 0, 0, 0)",
      preserveObjectStacking: true,
      perPixelTargetFind: true,
      targetFindTolerance: 10,
      selection: true,
      selectionColor: INSIGHT_SELECTION_FILL,
      selectionBorderColor: INSIGHT_SELECTION_COLOR,
      selectionLineWidth: 1.25,
      selectionDashArray: undefined,
      stopContextMenu: true,
    });

    canvasRef.current = canvas;
    if (typeof window !== "undefined") {
      (window as any).__remoraCreativeCanvas = canvas;
    }
    return () => {
      if (typeof window !== "undefined" && (window as any).__remoraCreativeCanvas === canvas) {
        delete (window as any).__remoraCreativeCanvas;
      }
      canvas.dispose();
      canvasRef.current = null;
    };
  }, [cardWidth, cardHeight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (skipNextCanvasHydrationRef.current) {
      skipNextCanvasHydrationRef.current = false;
      return;
    }

    let cancelled = false;
    isHydratingCanvasRef.current = true;
    canvas.setDimensions({ width: cardWidth, height: cardHeight });
    canvas.clear();
    canvas.backgroundColor = "rgba(0, 0, 0, 0)";

    const addElement = async (element: SideElement) => {
      if (element.type === "stroke") {
        const normalized = normalizeStrokeForFabric(element);
        const path = new Path(element.svgPath?.trim() ? element.svgPath : pointsToPath(normalized.points), {
          stroke: element.style.color,
          strokeWidth: element.style.width,
          fill: "",
          selectable: true,
          evented: true,
          perPixelTargetFind: false,
          objectCaching: false,
          left: normalized.left,
          top: normalized.top,
          angle: element.creative.rotation,
          strokeLineCap: "round",
          strokeLineJoin: "round",
          originX: "left",
          originY: "top",
        });

        path.set({
          scaleX: Math.max(0.01, element.creative.width / normalized.baseWidth),
          scaleY: Math.max(0.01, element.creative.height / normalized.baseHeight),
        });
        applyInsightSelectionStyle(path);

        (path as any).data = {
          kind: "stroke",
          elementId: element.id,
        };

        canvas.add(path);
        return;
      }

      if (element.type === "image") {
        if (!element.url) return;
        try {
          const image = await FabricImage.fromURL(element.url, { crossOrigin: "anonymous" });
          image.set({
            left: element.creative.x,
            top: element.creative.y,
            angle: element.creative.rotation,
            originX: "left",
            originY: "top",
          });
          image.scaleToWidth(element.creative.width);
          image.scaleToHeight(element.creative.height);
          applyInsightSelectionStyle(image);
          (image as any).data = {
            kind: "image",
            elementId: element.id,
          };
          canvas.add(image);
        } catch {
          // Ignore invalid image URLs.
        }
        return;
      }

      if (element.type === "richText") {
        const richTextBounds = new Rect({
          left: element.creative.x,
          top: element.creative.y,
          width: Math.max(RICH_TEXT_MIN_WIDTH, element.creative.width),
          height: Math.max(RICH_TEXT_MIN_HEIGHT, element.creative.height),
          angle: element.creative.rotation,
          originX: "left",
          originY: "top",
          // Keep target area hittable across the full textbox bounds while visually transparent.
          fill: "rgba(59, 130, 246, 0.001)",
          stroke: "rgba(0, 0, 0, 0)",
          strokeWidth: 0,
        });
        (richTextBounds as any).data = {
          kind: "richText",
          elementId: element.id,
        };
        applyInsightSelectionStyle(richTextBounds);
        canvas.add(richTextBounds);
        return;
      }

      const embed = new Rect({
        left: element.creative.x,
        top: element.creative.y,
        width: element.creative.width,
        height: element.creative.height,
        angle: element.creative.rotation,
        originX: "left",
        originY: "top",
        fill: "#f8fafc",
        stroke: "#94a3b8",
        strokeDashArray: [8, 4],
        rx: 10,
        ry: 10,
      });
      (embed as any).data = {
        kind: element.type,
        elementId: element.id,
      };
      applyInsightSelectionStyle(embed);

      const label = new Textbox("YouTube", {
        left: element.creative.x + 12,
        top: element.creative.y + 12,
        width: Math.max(80, element.creative.width - 24),
        fontSize: 16,
        editable: false,
        evented: false,
        fill: "#475569",
      });

      canvas.add(embed);
      canvas.add(label);
    };

    const run = async () => {
      try {
        for (const element of side.elements) {
          if (cancelled) return;
          await addElement(element);
        }

        const pendingSelectionIds = pendingSelectionElementIdsRef.current;
        if (pendingSelectionIds && pendingSelectionIds.length > 0) {
          const idSet = new Set(pendingSelectionIds);
          const selectedObjects = canvas
            .getObjects()
            .filter((object) => idSet.has(String((object as any)?.data?.elementId)));

          if (selectedObjects.length === 1) {
            applyInsightSelectionStyle(selectedObjects[0]);
            canvas.setActiveObject(selectedObjects[0]);
            setSelectedElementId(String((selectedObjects[0] as any)?.data?.elementId));
          } else if (selectedObjects.length > 1) {
            const activeSelection = new ActiveSelection(selectedObjects, { canvas });
            applyInsightSelectionStyle(activeSelection);
            canvas.setActiveObject(activeSelection);
            setSelectedElementId(String((selectedObjects[0] as any)?.data?.elementId));
          }
        }

        pendingSelectionElementIdsRef.current = null;
        if (!cancelled) {
          canvas.renderAll();
        }
      } finally {
        if (!cancelled) {
          isHydratingCanvasRef.current = false;
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      isHydratingCanvasRef.current = false;
    };
  }, [cardWidth, cardHeight, canvasSignature]);

  useEffect(() => {
    if (!editingRichTextId) return;
    const exists = side.elements.some(
      (element) => element.id === editingRichTextId && element.type === "richText",
    );
    if (!exists) {
      setEditingRichTextId(null);
    }
  }, [editingRichTextId, side.elements]);

  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = () => setContextMenu(null);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    for (const object of canvas.getObjects()) {
      const metadata = (object as any)?.data;
      const isEditableTextBox =
        metadata?.kind === "richText" && typeof metadata?.elementId === "string";
      if (!isEditableTextBox) continue;

      const isEditing = editingRichTextId != null && metadata.elementId === editingRichTextId;
      object.set({
        lockMovementX: isEditing,
        lockMovementY: isEditing,
      });
    }

    canvas.requestRenderAll();
  }, [editingRichTextId, canvasSignature]);

  useEffect(() => {
    setLiveRichTextTransforms((current) => {
      const existingIds = new Set(
        side.elements
          .filter((element): element is RichTextBlock => element.type === "richText")
          .map((element) => element.id),
      );
      let changed = false;
      const next: Record<string, { x: number; y: number; width: number; height: number; rotation: number }> = {};
      for (const [key, value] of Object.entries(current)) {
        if (existingIds.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [side.elements]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = tool === "draw";
    canvas.selection = tool === "select";
    canvas.skipTargetFind = tool === "draw";
    canvas.perPixelTargetFind = tool === "erase";
    canvas.targetFindTolerance = tool === "erase" ? 10 : 2;
    canvas.defaultCursor = tool === "erase" ? "crosshair" : "default";

    if (tool !== "select") {
      canvas.discardActiveObject();
      setSelectedElementId(null);
      setEditingRichTextId(null);
    }

    if (tool === "draw") {
      const brush = new PencilBrush(canvas);
      brush.color = strokeColor;
      brush.width = strokeWidth;
      canvas.freeDrawingBrush = brush;
    }

    for (const object of canvas.getObjects()) {
      const metadata = (object as any)?.data;
      object.selectable = tool === "select";
      object.evented = tool !== "draw";
      if (metadata?.kind === "stroke") {
        object.perPixelTargetFind = tool === "erase";
      }
    }

    canvas.renderAll();
  }, [tool, strokeColor, strokeWidth]);

  useEffect(() => {
    setContextMenu(null);
  }, [tool]);

  useEffect(() => {
    const viewport = stageViewportRef.current;
    if (!viewport) return;
    const contentRow =
      (viewport.closest('[data-testid="editor-content-row"]') as HTMLElement | null) ?? null;

    const recomputeScale = () => {
      const bounds = viewport.getBoundingClientRect();
      const usableWidth = Math.max(0, bounds.width - 12);
      const usableHeightFromViewport = Math.max(0, bounds.height - 12);
      const usableHeightFromContent = contentRow
        ? Math.max(0, contentRow.getBoundingClientRect().bottom - bounds.top - 8)
        : usableHeightFromViewport;
      const usableHeight = Math.min(usableHeightFromViewport, usableHeightFromContent);
      const scaleFromWidth = usableWidth / Math.max(1, cardOuterWidth);
      const scaleFromHeight = usableHeight / Math.max(1, cardOuterHeight);
      const nextScale = Math.max(0.48, Math.min(1, scaleFromWidth, scaleFromHeight));
      setStageScale((current) => (Math.abs(current - nextScale) < 0.01 ? current : nextScale));
    };

    recomputeScale();

    const resizeObserver = new ResizeObserver(recomputeScale);
    resizeObserver.observe(viewport);
    if (contentRow) {
      resizeObserver.observe(contentRow);
    }
    window.addEventListener("resize", recomputeScale);
    if (contentRow) {
      contentRow.addEventListener("scroll", recomputeScale, { passive: true });
    }

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", recomputeScale);
      if (contentRow) {
        contentRow.removeEventListener("scroll", recomputeScale);
      }
    };
  }, [cardOuterWidth, cardOuterHeight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const strokeWidthById = new Map(
      side.elements
        .filter((element): element is StrokePath => element.type === "stroke")
        .map((element) => [element.id, element.style.width] as const),
    );

    const findStrokeTarget = (event: any) => {
      const direct = canvas.findTarget(event.e) as any;
      if (direct?.data?.kind === "stroke") {
        return direct;
      }

      const pointer = canvas.getScenePoint(event.e);
      const objects = [...canvas.getObjects()].reverse() as any[];
      for (const object of objects) {
        const metadata = object?.data;
        if (metadata?.kind !== "stroke") continue;

        if (typeof object.containsPoint === "function" && object.containsPoint(pointer)) {
          return object;
        }

        const bounds =
          typeof object.getBoundingRect === "function"
            ? object.getBoundingRect(true, true)
            : null;
        if (!bounds) continue;

        const strokeTolerance = Math.max(
          10,
          (strokeWidthById.get(String(metadata.elementId)) ?? 5) * 2 + 6,
        );
        const isWithinBounds =
          pointer.x >= bounds.left - strokeTolerance &&
          pointer.x <= bounds.left + bounds.width + strokeTolerance &&
          pointer.y >= bounds.top - strokeTolerance &&
          pointer.y <= bounds.top + bounds.height + strokeTolerance;

        if (isWithinBounds) {
          return object;
        }
      }

      return null;
    };

    const clearHover = () => {
      const hovered = hoveredStrokeRef.current;
      if (hovered) {
        hovered.set({ stroke: hovered.__originalStroke ?? hovered.stroke, opacity: 1 });
      }
      hoveredStrokeRef.current = null;
      canvas.renderAll();
    };

    const onPathCreated = (event: any) => {
      if (!event.path) return;
      const path = event.path;
      const elementId = `stroke-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      (path as any).data = {
        kind: "stroke",
        elementId,
      };

      const normalizedStroke = strokeFromFabricPath(path);
      // Keep the just-drawn Fabric path in-place and avoid immediate full canvas re-hydration jump.
      skipNextCanvasHydrationRef.current = true;
      onApply(
        [
          {
            kind: "addElement",
            element: {
              id: elementId,
              type: "stroke",
              points: normalizedStroke.points,
              svgPath: normalizedStroke.svgPath,
              baseWidth: normalizedStroke.baseWidth,
              baseHeight: normalizedStroke.baseHeight,
              style: {
                color: path.stroke ?? strokeColor,
                width: path.strokeWidth ?? strokeWidth,
              },
              quick: { order: side.elements.length },
              creative: normalizedStroke.creative,
            } as StrokePath,
          },
        ],
        { source: "creative", batchKey: `stroke-${elementId}` },
      );
    };

    const onObjectModified = (event: any) => {
      const target = event?.target;
      if (!target) return;

      if (isActiveSelectionTarget(target)) {
        const snapshot =
          activeSelectionSnapshotRef.current ?? buildActiveSelectionSnapshot(target, side.elements);
        if (!snapshot) return;

        constrainObjectPositionToCardBounds(target, cardWidth, cardHeight);
        const bounds = getObjectBounds(target);
        if (!bounds) return;

        const deltaX = bounds.left - snapshot.bounds.left;
        const deltaY = bounds.top - snapshot.bounds.top;

        const updates: Record<string, CreativeTransform> = {};
        const operations: Array<Extract<SideOperation, { kind: "transformElement" }>> = [];

        for (const entry of snapshot.entries) {
          const creative = clampCreativeTransform(
            {
              ...entry.creative,
              x: entry.creative.x + deltaX,
              y: entry.creative.y + deltaY,
            },
            cardWidth,
            cardHeight,
          );

          if (entry.kind === "richText") {
            updates[entry.elementId] = creative;
          }

          operations.push({
            kind: "transformElement",
            elementId: entry.elementId,
            creative,
          });
        }

        if (Object.keys(updates).length > 0) {
          setLiveRichTextTransforms((current) => ({
            ...current,
            ...updates,
          }));
        }

        if (operations.length > 0) {
          setSelectedElementId(operations[0]?.elementId ?? null);
          pendingSelectionElementIdsRef.current = operations.map((operation) => operation.elementId);
          onApply(operations, {
            source: "creative",
            batchKey: `transform-selection-${operations
              .map((operation) => operation.elementId)
              .sort()
              .join("-")}`,
          });
          applyInsightSelectionStyle(target);
          canvas.setActiveObject(target);
          suppressSelectionClearedUntilRef.current = Date.now() + 250;
          canvas.requestRenderAll();
        }

        activeSelectionSnapshotRef.current = null;
        return;
      }

      const transformTargets = collectTransformTargets(target);
      if (transformTargets.length === 0) return;

      const isSizeChanging = isSizeChangingTransformAction(event?.transform?.action);
      if (isSizeChanging) {
        constrainObjectToCardBounds(target, cardWidth, cardHeight);
      } else {
        constrainObjectPositionToCardBounds(target, cardWidth, cardHeight);
      }
      const existingById = new Map(side.elements.map((element) => [element.id, element] as const));

      const updates: Record<
        string,
        { x: number; y: number; width: number; height: number; rotation: number }
      > = {};
      const operations: Array<Extract<SideOperation, { kind: "transformElement" }>> = [];

      for (const entry of transformTargets) {
        const existing = existingById.get(entry.metadata.elementId);
        const measured = elementTransformFromObject(entry.object);
        const creative = clampCreativeTransform(
          existing && !isSizeChanging
            ? {
                ...measured,
                width: existing.creative.width,
                height: existing.creative.height,
              }
            : measured,
          cardWidth,
          cardHeight,
        );
        if (entry.metadata.kind === "richText") {
          updates[entry.metadata.elementId] = creative;
        }
        operations.push({
          kind: "transformElement",
          elementId: entry.metadata.elementId,
          creative,
        });
      }

      if (Object.keys(updates).length > 0) {
        setLiveRichTextTransforms((current) => ({
          ...current,
          ...updates,
        }));
      }

      if (operations.length > 0) {
        setSelectedElementId(operations[0]?.elementId ?? null);
        pendingSelectionElementIdsRef.current = operations.map((operation) => operation.elementId);
        const batchKey =
          operations.length === 1
            ? `transform-${operations[0].elementId}`
            : `transform-selection-${operations
                .map((operation) => operation.elementId)
                .sort()
                .join("-")}`;
        onApply(operations, { source: "creative", batchKey });
        applyInsightSelectionStyle(target);
        canvas.setActiveObject(target);
        suppressSelectionClearedUntilRef.current = Date.now() + 250;
        canvas.requestRenderAll();
      }
      activeSelectionSnapshotRef.current = null;
    };

    const onObjectTransforming = (event: any) => {
      const target = event?.target;
      if (!target) return;

      if (isActiveSelectionTarget(target)) {
        const snapshot =
          activeSelectionSnapshotRef.current ?? buildActiveSelectionSnapshot(target, side.elements);
        if (!snapshot) return;
        activeSelectionSnapshotRef.current = snapshot;

        constrainObjectPositionToCardBounds(target, cardWidth, cardHeight);
        const bounds = getObjectBounds(target);
        if (!bounds) return;

        const deltaX = bounds.left - snapshot.bounds.left;
        const deltaY = bounds.top - snapshot.bounds.top;
        const updates: Record<string, CreativeTransform> = {};

        for (const entry of snapshot.entries) {
          if (entry.kind !== "richText") continue;
          updates[entry.elementId] = clampCreativeTransform(
            {
              ...entry.creative,
              x: entry.creative.x + deltaX,
              y: entry.creative.y + deltaY,
            },
            cardWidth,
            cardHeight,
          );
        }

        if (Object.keys(updates).length > 0) {
          setLiveRichTextTransforms((current) => ({
            ...current,
            ...updates,
          }));
        }
        return;
      }

      const transformTargets = collectTransformTargets(target);
      if (transformTargets.length === 0) return;

      const isSizeChanging = isSizeChangingTransformAction(event?.transform?.action);
      if (isSizeChanging) {
        constrainObjectToCardBounds(target, cardWidth, cardHeight);
      } else {
        constrainObjectPositionToCardBounds(target, cardWidth, cardHeight);
      }
      const existingById = new Map(side.elements.map((element) => [element.id, element] as const));

      const updates: Record<
        string,
        { x: number; y: number; width: number; height: number; rotation: number }
      > = {};
      for (const entry of transformTargets) {
        if (entry.metadata.kind !== "richText") continue;
        const existing = existingById.get(entry.metadata.elementId);
        const measured = elementTransformFromObject(entry.object);
        updates[entry.metadata.elementId] = clampCreativeTransform(
          existing && !isSizeChanging
            ? {
                ...measured,
                width: existing.creative.width,
                height: existing.creative.height,
              }
            : measured,
          cardWidth,
          cardHeight,
        );
      }

      if (Object.keys(updates).length > 0) {
        setLiveRichTextTransforms((current) => ({
          ...current,
          ...updates,
        }));
      }
    };

    const onMouseMove = (event: any) => {
      if (tool !== "erase") return;
      const target = findStrokeTarget(event);
      const metadata = target?.data;

      if (hoveredStrokeRef.current && hoveredStrokeRef.current !== target) {
        const prev = hoveredStrokeRef.current;
        prev.set({ stroke: prev.__originalStroke ?? prev.stroke, opacity: 1 });
        hoveredStrokeRef.current = null;
      }

      if (!target || metadata?.kind !== "stroke") {
        canvas.renderAll();
        return;
      }

      if (!target.__originalStroke) {
        target.__originalStroke = target.stroke;
      }

      target.set({ stroke: "#ef4444", opacity: 0.96 });
      hoveredStrokeRef.current = target;
      canvas.renderAll();
    };

    const onMouseDown = (event: any) => {
      if (event?.e?.button === 2) {
        event.e.preventDefault?.();
        event.e.stopPropagation?.();
        const target = event?.target ?? null;
        const selectedId = target?.data?.elementId;
        const selectedKind = target?.data?.kind;
        if (typeof selectedId === "string") {
          setSelectedElementId(selectedId);
          if (selectedKind !== "richText") {
            setEditingRichTextId(null);
          }
          if (tool === "select") {
            applyInsightSelectionStyle(target);
            canvas.setActiveObject(target);
          }
          setContextMenu({
            x: event.e.clientX,
            y: event.e.clientY,
            elementId: selectedId,
            kind: typeof selectedKind === "string" ? selectedKind : undefined,
          });
        } else {
          setContextMenu(null);
        }
        canvas.requestRenderAll();
        return;
      }

      setContextMenu(null);

      if (tool === "select") {
        const activeObject = canvas.getActiveObject();
        if (isActiveSelectionTarget(activeObject)) {
          activeSelectionSnapshotRef.current = buildActiveSelectionSnapshot(activeObject, side.elements);
        }
        const target = event?.target ?? null;
        const selectedId = target?.data?.elementId;
        const selectedKind = target?.data?.kind;
        setSelectedElementId(typeof selectedId === "string" ? selectedId : null);
        if (selectedKind === "richText" && typeof selectedId === "string") {
          // Canvas interaction should exit inline edit mode so move/resize remains predictable.
          if (editingRichTextId) {
            setEditingRichTextId(null);
          }
          if (typeof target?.set === "function") {
            target.set({
              lockMovementX: false,
              lockMovementY: false,
            });
          }
        } else {
          setEditingRichTextId(null);
        }
        return;
      }

      if (tool !== "erase") return;
      const target = findStrokeTarget(event);
      const metadata = target?.data;
      if (!target || metadata?.kind !== "stroke") return;

      canvas.remove(target as any);
      clearHover();
      onApply([{ kind: "removeElement", elementId: metadata.elementId }], {
        source: "creative",
        batchKey: `erase-${metadata.elementId}`,
      });
    };

    const onSelectionChanged = (event: any) => {
      if (isHydratingCanvasRef.current) return;
      let selectedTarget = event?.selected?.[0] ?? event?.target ?? null;
      if ((!selectedTarget?.data?.elementId || !selectedTarget?.data?.kind) && isActiveSelectionTarget(event?.target)) {
        const objects = (event.target.getObjects?.() ?? []) as any[];
        const firstObjectWithData = objects.find((object) => object?.data?.elementId);
        if (firstObjectWithData) {
          selectedTarget = firstObjectWithData;
        }
      }
      const selectedIdRaw = selectedTarget?.data?.elementId;
      const selectedKindRaw = selectedTarget?.data?.kind;
      const selectedId =
        typeof selectedIdRaw === "string" && selectedIdRaw.length > 0
          ? selectedIdRaw
          : selectedElementIdRef.current;
      const selectedKind =
        typeof selectedKindRaw === "string" && selectedKindRaw.length > 0
          ? selectedKindRaw
          : side.elements.find((element) => element.id === selectedId)?.type;
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        applyInsightSelectionStyle(activeObject);
      }
      setSelectedElementId(typeof selectedId === "string" ? selectedId : null);
      if (selectedKind !== "richText") {
        setEditingRichTextId(null);
      } else if (typeof selectedId === "string" && editingRichTextId && editingRichTextId !== selectedId) {
        setEditingRichTextId(null);
      }
    };

    const onSelectionCleared = (event: any) => {
      if (isHydratingCanvasRef.current) {
        return;
      }

      if (suppressNextSelectionClearedRef.current) {
        suppressNextSelectionClearedRef.current = false;
        return;
      }

      if (Date.now() < suppressSelectionClearedUntilRef.current) {
        return;
      }

      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        const activeId = String((activeObject as any)?.data?.elementId ?? "");
        if (activeId) {
          applyInsightSelectionStyle(activeObject);
          setSelectedElementId(activeId);
          canvas.requestRenderAll();
          return;
        }
      }

      // Fabric can emit transient clear events during drag/rehydration; preserve pending selection in those cases.
      const pendingSelectionIds = pendingSelectionElementIdsRef.current;
      if (activeSelectionSnapshotRef.current || (pendingSelectionIds?.length ?? 0) > 0) {
        if ((pendingSelectionIds?.length ?? 0) > 0) {
          setSelectedElementId(pendingSelectionIds?.[0] ?? null);
        }
        return;
      }

      if (editingRichTextId && !event?.e) {
        const editingObject = canvas
          .getObjects()
          .find((object) => String((object as any)?.data?.elementId) === editingRichTextId);
        if (editingObject) {
          applyInsightSelectionStyle(editingObject);
          canvas.setActiveObject(editingObject as any);
          setSelectedElementId(editingRichTextId);
          canvas.requestRenderAll();
          return;
        }
      }

      if (!event?.e && selectedElementIdRef.current) {
        const selectedObject = canvas
          .getObjects()
          .find((object) => String((object as any)?.data?.elementId) === selectedElementIdRef.current);
        if (selectedObject) {
          applyInsightSelectionStyle(selectedObject);
          canvas.setActiveObject(selectedObject as any);
          setSelectedElementId(selectedElementIdRef.current);
          canvas.requestRenderAll();
          return;
        }
      }

      activeSelectionSnapshotRef.current = null;
      pendingSelectionElementIdsRef.current = null;
      const fallbackSelectedId = selectedElementIdRef.current;
      if (fallbackSelectedId && side.elements.some((element) => element.id === fallbackSelectedId)) {
        setSelectedElementId(fallbackSelectedId);
        setEditingRichTextId(null);
        return;
      }
      setSelectedElementId(null);
      setEditingRichTextId(null);
    };

    const onDoubleClick = (event: any) => {
      if (tool !== "select") return;
      const selectedTarget = event?.target ?? null;
      const selectedId = selectedTarget?.data?.elementId;
      if (selectedTarget?.data?.kind !== "richText" || typeof selectedId !== "string") return;
      suppressNextSelectionClearedRef.current = true;
      setSelectedElementId(selectedId);
      setEditingRichTextId(selectedId);
      applyInsightSelectionStyle(selectedTarget);
      canvas.setActiveObject(selectedTarget);
      canvas.requestRenderAll();
    };

    canvas.on("path:created", onPathCreated);
    canvas.on("object:modified", onObjectModified);
    canvas.on("object:moving", onObjectTransforming);
    canvas.on("object:scaling", onObjectTransforming);
    canvas.on("object:rotating", onObjectTransforming);
    canvas.on("mouse:move", onMouseMove);
    canvas.on("mouse:down", onMouseDown);
    canvas.on("mouse:dblclick", onDoubleClick);
    canvas.on("selection:created", onSelectionChanged);
    canvas.on("selection:updated", onSelectionChanged);
    canvas.on("selection:cleared", onSelectionCleared);

    return () => {
      canvas.off("path:created", onPathCreated);
      canvas.off("object:modified", onObjectModified);
      canvas.off("object:moving", onObjectTransforming);
      canvas.off("object:scaling", onObjectTransforming);
      canvas.off("object:rotating", onObjectTransforming);
      canvas.off("mouse:move", onMouseMove);
      canvas.off("mouse:down", onMouseDown);
      canvas.off("mouse:dblclick", onDoubleClick);
      canvas.off("selection:created", onSelectionChanged);
      canvas.off("selection:updated", onSelectionChanged);
      canvas.off("selection:cleared", onSelectionCleared);
      clearHover();
    };
  }, [tool, onApply, side.elements, strokeColor, strokeWidth, editingRichTextId, cardWidth, cardHeight]);

  const addText = () => {
    const next = createRichTextElement(String(Date.now()), side.elements.length);
    const richTextCount = side.elements.filter((element) => element.type === "richText").length;
    const staggerOffset = Math.min(64, richTextCount * 12);
    const defaultY = 260 + richTextCount * 22;
    next.creative = {
      ...next.creative,
      x: Math.min(Math.max(0, cardWidth - next.creative.width), 118 + staggerOffset),
      y: Math.min(Math.max(0, cardHeight - next.creative.height), defaultY),
    };
    setSelectedElementId(next.id);
    setEditingRichTextId(null);
    suppressSelectionClearedUntilRef.current = Date.now() + 350;
    pendingSelectionElementIdsRef.current = [next.id];
    onApply(
      [
        {
          kind: "addElement",
          element: next,
        },
      ],
      { source: "creative" },
    );
    setTool("select");
  };

  const addImage = () => {
    const url = window.prompt("Image URL");
    if (!url) return;

    onApply(
      [
        {
          kind: "addElement",
          element: {
            id: `img-${Date.now()}`,
            type: "image",
            url,
            quick: { order: side.elements.length },
            creative: {
              x: 96,
              y: 72,
              width: 300,
              height: 190,
              rotation: 0,
            },
          } as SideElement,
        },
      ],
      { source: "creative" },
    );
  };

  const selectedTextColor = selectedRichText
    ? getFirstTextStyleProperty(selectedRichText.lexical, "color") ?? "#0f172a"
    : "#0f172a";
  const fontSizeOptions = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];
  const selectedFontSize = selectedRichText
    ? getFirstTextStyleProperty(selectedRichText.lexical, "font-size") ?? "16px"
    : "16px";
  const selectedFontSizeValue = fontSizeOptions.includes(selectedFontSize) ? selectedFontSize : "16px";
  const selectedIsBold = selectedRichText
    ? hasAnyTextFormatBit(selectedRichText.lexical, TEXT_FORMAT_BITS.bold)
    : false;
  const selectedIsItalic = selectedRichText
    ? hasAnyTextFormatBit(selectedRichText.lexical, TEXT_FORMAT_BITS.italic)
    : false;
  const selectedIsUnderline = selectedRichText
    ? hasAnyTextFormatBit(selectedRichText.lexical, TEXT_FORMAT_BITS.underline)
    : false;
  const selectedIsStrikethrough = selectedRichText
    ? hasAnyTextFormatBit(selectedRichText.lexical, TEXT_FORMAT_BITS.strikethrough)
    : false;
  const selectedHasBulletList = selectedRichText ? hasRootListType(selectedRichText.lexical, "bullet") : false;
  const selectedHasNumberedList = selectedRichText ? hasRootListType(selectedRichText.lexical, "number") : false;
  const selectedIsCentered = selectedRichText ? isCenterAligned(selectedRichText.lexical) : false;
  const selectedLinkUrl = selectedRichText ? getFirstLinkUrl(selectedRichText.lexical) : null;
  const canApplyTextStyle = !!selectedRichText && editingRichTextId === selectedRichText.id;
  const strokeElements = useMemo(
    () => side.elements.filter((element): element is StrokePath => element.type === "stroke"),
    [side.elements],
  );
  const hasStrokes = strokeElements.length > 0;
  const normalizedStrokeColor = strokeColor.toLowerCase();
  const isPresetStrokeColor = DRAW_COLOR_SWATCHES.some((color) => color.toLowerCase() === normalizedStrokeColor);

  const applyRichTextUpdate = (nextLexical: unknown, suffix: string) => {
    if (!selectedRichText) return;
    pendingSelectionElementIdsRef.current = [selectedRichText.id];
    onApply(
      [
        {
          kind: "updateElement",
          elementId: selectedRichText.id,
          patch: { lexical: nextLexical } as Partial<SideElement>,
        },
      ],
      {
        source: "creative",
        batchKey: `creative-richtext-${selectedRichText.id}-${suffix}`,
        coalesceMs: 300,
      },
    );
  };

  const applyLinkFromPrompt = () => {
    if (!selectedRichText) return;
    const defaultUrl = selectedLinkUrl ?? "https://";
    const raw = window.prompt("Enter URL (leave empty to remove link)", defaultUrl);
    if (raw === null) return;
    const trimmed = raw.trim();
    if (!trimmed) {
      applyRichTextUpdate(setLinkOnAllBlocks(selectedRichText.lexical, null), "link-remove");
      return;
    }
    const safe = normalizeHttpUrl(trimmed);
    if (!safe) {
      window.alert("Enter a valid URL.");
      return;
    }
    applyRichTextUpdate(setLinkOnAllBlocks(selectedRichText.lexical, safe), "link");
  };

  const decreaseStrokeWidth = () => {
    setStrokeWidth((current) => Math.max(1, current - 1));
  };

  const increaseStrokeWidth = () => {
    setStrokeWidth((current) => Math.min(20, current + 1));
  };

  const clearStrokeElements = () => {
    if (!hasStrokes) return;
    onApply(
      strokeElements.map((stroke) => ({ kind: "removeElement" as const, elementId: stroke.id })),
      {
        source: "creative",
        batchKey: `clear-strokes-${Date.now()}`,
      },
    );
  };

  useEffect(() => {
    const isLegacySize =
      Math.abs(cardWidth - LEGACY_CREATIVE_WIDTH) < 0.01 &&
      Math.abs(cardHeight - LEGACY_CREATIVE_HEIGHT) < 0.01;
    if (!isLegacySize) return;

    const scaleX = UPSIZED_CREATIVE_WIDTH / Math.max(1, cardWidth);
    const scaleY = UPSIZED_CREATIVE_HEIGHT / Math.max(1, cardHeight);

    const transformOps: Array<Extract<SideOperation, { kind: "transformElement" }>> = side.elements.map((element) => ({
      kind: "transformElement",
      elementId: element.id,
      creative: {
        x: element.creative.x * scaleX,
        y: element.creative.y * scaleY,
        width: Math.max(1, element.creative.width * scaleX),
        height: Math.max(1, element.creative.height * scaleY),
      },
    }));

    onApply(
      [
        ...transformOps,
        {
          kind: "setCreativeProjection",
          creativeLayout: {
            width: UPSIZED_CREATIVE_WIDTH,
            height: UPSIZED_CREATIVE_HEIGHT,
            padding: Math.max(1, side.layout.creativeLayout.padding * scaleX),
          },
        },
      ],
      {
        source: "system",
        batchKey: "creative-layout-upsize-legacy-672x448",
      },
    );
  }, [cardWidth, cardHeight, onApply, side.elements, side.layout.creativeLayout.padding]);

  const resolveCreativeTransform = (element: RichTextBlock) =>
    liveRichTextTransforms[element.id] ?? element.creative;

  const isInlineRichTextEditing = tool === "select" && !!editingRichText;
  const inlineEditorStyle = editingRichText
    ? {
        left: resolveCreativeTransform(editingRichText).x,
        top: resolveCreativeTransform(editingRichText).y,
        width: Math.max(RICH_TEXT_MIN_WIDTH, resolveCreativeTransform(editingRichText).width),
        height: Math.max(RICH_TEXT_MIN_HEIGHT, resolveCreativeTransform(editingRichText).height),
        transform: `rotate(${resolveCreativeTransform(editingRichText).rotation ?? 0}deg)`,
        transformOrigin: "top left",
      }
    : null;

  return (
    <div className="relative flex min-h-full flex-col gap-3 pr-14 md:pr-16">
      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center">
        <div className="pointer-events-auto inline-flex flex-col items-center gap-1 rounded-xl border border-border bg-background p-1.5">
          <Button
            type="button"
            variant={tool === "select" ? "default" : "outline"}
            size="icon"
            aria-label="Select"
            title="Select"
            className="h-8 w-8"
            onClick={() => setTool("select")}
          >
            <MousePointer2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={tool === "draw" ? "default" : "outline"}
            size="icon"
            aria-label="Draw"
            title="Draw"
            className="h-8 w-8"
            onClick={() => setTool("draw")}
          >
            <PenLine className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={tool === "erase" ? "default" : "outline"}
            size="icon"
            aria-label="Erase"
            title="Erase"
            className="h-8 w-8"
            onClick={() => setTool("erase")}
          >
            <Eraser className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Add text"
            title="Add text"
            className="h-8 w-8"
            onClick={addText}
            data-testid="creative-add-text-button"
          >
            <Type className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Add image"
            title="Add image"
            className="h-8 w-8"
            onClick={addImage}
            data-testid="creative-add-image-button"
          >
            <ImagePlus className="h-4 w-4" />
          </Button>

        </div>
      </div>

      <div className="min-h-[56px]">
        {tool === "draw" ? (
          <div className="flex justify-center" data-testid="creative-draw-toolbar-row">
            <div className="flex w-full max-w-2xl flex-wrap items-center justify-center gap-1 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5">
              <div className="h-5 w-px bg-border" />
              <span className="text-xs text-muted-foreground">Size:</span>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={decreaseStrokeWidth}
                title="Decrease stroke size"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                type="number"
                min={1}
                max={20}
                step={1}
                value={strokeWidth}
                onChange={(event) => {
                  const raw = event.target.value;
                  const next = Number.parseInt(raw, 10);
                  if (!Number.isFinite(next)) return;
                  setStrokeWidth(Math.min(20, Math.max(1, next)));
                }}
                className="h-7 w-11 rounded-md border border-border bg-background px-1 text-center text-sm font-semibold text-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                title="Stroke size"
              />
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={increaseStrokeWidth}
                title="Increase stroke size"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>

              <div className="h-5 w-px bg-border" />
              <span className="text-xs text-muted-foreground">Color:</span>
              {DRAW_COLOR_SWATCHES.map((color) => {
                const isActive = normalizedStrokeColor === color.toLowerCase();
                return (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Set draw color ${color}`}
                    className={[
                      "h-7 w-7 rounded-full border transition-all",
                      isActive ? "border-foreground ring-1 ring-foreground/20" : "border-border hover:border-foreground/60",
                    ].join(" ")}
                    style={{ backgroundColor: color }}
                    onClick={() => setStrokeColor(color)}
                  />
                );
              })}
              <label
                className={[
                  "relative block h-7 w-7 overflow-hidden rounded-full border transition-all",
                  !isPresetStrokeColor ? "border-foreground ring-1 ring-foreground/20" : "border-border hover:border-foreground/60",
                ].join(" ")}
                title="Custom stroke color"
              >
                <input
                  type="color"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  value={strokeColor}
                  onChange={(event) => setStrokeColor(event.target.value)}
                />
                <span
                  className="block h-full w-full"
                  style={{
                    background:
                      "conic-gradient(from 180deg at 50% 50%, #ff0000, #ff7a00, #ffff00, #00ff00, #00e5ff, #0048ff, #7a00ff, #ff00c8, #ff0000)",
                  }}
                />
              </label>

              <div className="h-5 w-px bg-border" />
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
                onClick={clearStrokeElements}
                title="Clear drawings"
                disabled={!hasStrokes}
                data-testid="creative-clear-strokes-button"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}

        {tool === "select" && selectedRichText ? (
          <div className="flex justify-center" data-testid="creative-richtext-toolbar-row">
            <div className="flex w-full max-w-2xl flex-wrap items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/50 p-2">
            <Button
              type="button"
              variant={selectedIsBold ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              title="Bold"
              disabled={!canApplyTextStyle}
              onClick={() => applyRichTextUpdate(toggleTextFormatBitOnAll(selectedRichText.lexical, TEXT_FORMAT_BITS.bold), "bold")}
            >
              <span className="text-sm font-semibold">B</span>
            </Button>
            <Button
              type="button"
              variant={selectedIsItalic ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              title="Italic"
              disabled={!canApplyTextStyle}
              onClick={() =>
                applyRichTextUpdate(toggleTextFormatBitOnAll(selectedRichText.lexical, TEXT_FORMAT_BITS.italic), "italic")
              }
            >
              <span className="text-sm italic">I</span>
            </Button>
            <Button
              type="button"
              variant={selectedIsUnderline ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              title="Underline"
              disabled={!canApplyTextStyle}
              onClick={() =>
                applyRichTextUpdate(toggleTextFormatBitOnAll(selectedRichText.lexical, TEXT_FORMAT_BITS.underline), "underline")
              }
            >
              <span className="text-sm underline">U</span>
            </Button>
            <Button
              type="button"
              variant={selectedIsStrikethrough ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              title="Strikethrough"
              disabled={!canApplyTextStyle}
              onClick={() =>
                applyRichTextUpdate(
                  toggleTextFormatBitOnAll(selectedRichText.lexical, TEXT_FORMAT_BITS.strikethrough),
                  "strikethrough",
                )
              }
            >
              <span className="text-sm line-through">S</span>
            </Button>

            <div className="mx-1 h-6 w-px bg-border" />

            <Button
              type="button"
              variant={selectedHasBulletList ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              title="Bullet List"
              disabled={!canApplyTextStyle}
              onClick={() => applyRichTextUpdate(toggleListTypeOnRoot(selectedRichText.lexical, "bullet"), "list-bullet")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={selectedHasNumberedList ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              title="Numbered List"
              disabled={!canApplyTextStyle}
              onClick={() => applyRichTextUpdate(toggleListTypeOnRoot(selectedRichText.lexical, "number"), "list-number")}
            >
              <ListOrdered className="h-4 w-4" />
            </Button>

            <div className="mx-1 h-6 w-px bg-border" />

            <Button
              type="button"
              variant={selectedLinkUrl ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              title="Link"
              disabled={!canApplyTextStyle}
              onClick={applyLinkFromPrompt}
            >
              <Link2 className="h-4 w-4" />
            </Button>

            <div className="mx-1 h-6 w-px bg-border" />

            <select
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              value={selectedFontSizeValue}
              disabled={!canApplyTextStyle}
              onChange={(event) =>
                applyRichTextUpdate(
                  setTextStylePropertyOnAll(selectedRichText.lexical, "font-size", event.target.value),
                  "font-size",
                )
              }
              title="Font size"
            >
              {fontSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>

            <Button
              type="button"
              variant={selectedIsCentered ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              title="Align Center"
              disabled={!canApplyTextStyle}
              onClick={() =>
                applyRichTextUpdate(
                  setBlockAlignmentOnAll(selectedRichText.lexical, selectedIsCentered ? "left" : "center"),
                  "align-center",
                )
              }
            >
              <AlignCenter className="h-4 w-4" />
            </Button>

            <label className="relative block h-8 w-8 overflow-hidden rounded border border-border">
              <input
                type="color"
                value={selectedTextColor}
                disabled={!canApplyTextStyle}
                onChange={(event) =>
                  applyRichTextUpdate(
                    setTextStylePropertyOnAll(selectedRichText.lexical, "color", event.target.value),
                    "color",
                  )
                }
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                title="Text Color"
              />
              <span className="block h-full w-full" style={{ backgroundColor: selectedTextColor }} />
            </label>

            <div className="mx-1 h-6 w-px bg-border" />

              <Button
                type="button"
                size="sm"
                variant={editingRichTextId === selectedRichText.id ? "default" : "outline"}
                className="h-8 px-3 text-xs"
                onClick={() =>
                  setEditingRichTextId((current) => (current === selectedRichText.id ? null : selectedRichText.id))
                }
              >
                {editingRichTextId === selectedRichText.id ? "Done" : "Edit Text"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-[1040px] flex-1 items-center" data-testid="creative-card-stage">
        <div ref={stageViewportRef} className="flex h-full w-full items-center justify-center overflow-hidden">
          <div
            className="origin-top"
            style={{
              width: cardOuterWidth,
              height: cardOuterHeight,
              transform: `scale(${stageScale})`,
            }}
            data-testid="creative-card-scale-frame"
          >
            <div
            className="relative rounded-2xl border border-zinc-200/80 p-1.5 shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
            style={{ backgroundColor: side.layout.creativeLayout.background }}
            data-testid="creative-card-shell"
          >
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 z-0" data-testid="creative-richtext-static-layer">
                {richTextElements.map((element) => {
                  if (editingRichTextId === element.id && tool === "select") return null;
                  const creativeTransform = resolveCreativeTransform(element);
                  return (
                    <div
                      key={element.id}
                      className="absolute overflow-hidden"
                      style={{
                        left: creativeTransform.x,
                        top: creativeTransform.y,
                        width: Math.max(RICH_TEXT_MIN_WIDTH, creativeTransform.width),
                        height: Math.max(RICH_TEXT_MIN_HEIGHT, creativeTransform.height),
                        transform: `rotate(${creativeTransform.rotation ?? 0}deg)`,
                        transformOrigin: "top left",
                      }}
                      data-testid={`creative-richtext-static-${element.id}`}
                    >
                      <LexicalRichTextView
                        lexical={element.lexical}
                        scale={1}
                        scrollOnHover
                        className="h-full w-full leading-[1.35] text-[#0f172a]"
                      />
                    </div>
                  );
                })}
              </div>
              <canvas ref={canvasElRef} className="relative z-10 block rounded-xl bg-transparent" data-testid="creative-card-canvas" />
              {isInlineRichTextEditing && inlineEditorStyle && editingRichText && (
                <div
                  className="pointer-events-none absolute z-20 overflow-visible bg-transparent"
                  style={inlineEditorStyle}
                  data-testid="creative-inline-richtext-editor"
                >
                  <div
                    className="pointer-events-auto h-full w-full"
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setEditingRichTextId(null);
                      }
                    }}
                  >
                    <LexicalRichTextEditor
                      variant="inline"
                      showToolbar={false}
                      className="h-full w-full border-0 bg-transparent shadow-none"
                      editorKey={`creative-${editingRichText.id}`}
                      value={editingRichText.lexical}
                      onImageInsert={addImage}
                      onChange={(nextLexical) => {
                        pendingSelectionElementIdsRef.current = [editingRichText.id];
                        onApply(
                          [
                            {
                              kind: "updateElement",
                              elementId: editingRichText.id,
                              patch: { lexical: nextLexical } as Partial<SideElement>,
                            },
                          ],
                          {
                            source: "creative",
                            batchKey: `creative-richtext-${editingRichText.id}`,
                            coalesceMs: 450,
                          },
                        );
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>

      {contextMenu && contextMenuElement && (
        <div
          className="fixed z-50 min-w-[170px] rounded-lg border border-border bg-popover py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          data-testid="creative-context-menu"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => moveElementOrder(contextMenuElement.id, "forward")}
          >
            Bring Forward
          </button>
          <button
            type="button"
            className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => moveElementOrder(contextMenuElement.id, "backward")}
          >
            Send Backward
          </button>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            className="w-full px-3 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
            onClick={() => deleteElementById(contextMenuElement.id)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

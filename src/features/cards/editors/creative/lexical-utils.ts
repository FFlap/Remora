import type { RichTextBlock } from "@/features/cards/side-ir/types";
import { DEFAULT_RICHTEXT_CREATIVE_BOUNDS } from "../../../../../shared/sideIRDefaults";

type BlockAlignment = "left" | "center" | "right" | "justify";

export type LexicalTextNode = {
  type?: string;
  text?: string;
  url?: string;
  listType?: "bullet" | "number";
  tag?: string;
  format?: number | string;
  style?: string;
  children?: LexicalTextNode[];
};

type LexicalRootState = {
  root?: {
    children?: LexicalTextNode[];
  };
};

export function createDefaultLexicalState() {
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
  };
}

export function createRichTextElement(seed: string, order: number): RichTextBlock {
  return {
    id: `rich-${seed}`,
    type: "richText",
    lexical: createDefaultLexicalState(),
    quick: { order },
    creative: { ...DEFAULT_RICHTEXT_CREATIVE_BOUNDS },
  };
}

function cloneLexicalState(value: unknown): LexicalRootState {
  try {
    return JSON.parse(JSON.stringify(value ?? createDefaultLexicalState())) as LexicalRootState;
  } catch {
    return createDefaultLexicalState() as LexicalRootState;
  }
}

function walkTextNodes(
  nodes: LexicalTextNode[] | undefined,
  visitor: (node: LexicalTextNode) => void,
) {
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

export function getFirstTextStyleProperty(lexical: unknown, property: string) {
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

export function hasAnyTextFormatBit(lexical: unknown, bit: number) {
  const clone = cloneLexicalState(lexical);
  let hasBit = false;
  walkTextNodes(clone.root?.children, (node) => {
    if (hasBit) return;
    const format = normalizeTextFormat(node.format);
    hasBit = (format & bit) !== 0;
  });
  return hasBit;
}

export function toggleTextFormatBitOnAll(lexical: unknown, bit: number) {
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

export function setTextStylePropertyOnAll(lexical: unknown, property: string, value: string) {
  const clone = cloneLexicalState(lexical);
  walkTextNodes(clone.root?.children, (node) => {
    const styleMap = parseStyleMap(node.style);
    styleMap.set(property, value);
    node.style = styleMapToString(styleMap);
  });
  return clone;
}

export function normalizeHttpUrl(raw: string) {
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

export function getFirstLinkUrl(lexical: unknown) {
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

export function toggleListTypeOnRoot(lexical: unknown, listType: "bullet" | "number") {
  const clone = cloneLexicalState(lexical);
  const rootChildren = clone.root?.children;
  if (!Array.isArray(rootChildren) || rootChildren.length === 0) return clone;
  const inheritedAlignment = getBlockAlignment(clone);

  if (rootChildren.length === 1 && rootChildren[0]?.type === "list") {
    const existing = rootChildren[0];
    if (existing.listType === listType) {
      const unwrapped = (existing.children ?? [])
        .map((child) => {
          if (
            child?.type === "listitem" &&
            Array.isArray(child.children) &&
            child.children.length > 0
          ) {
            const firstChild = child.children[0] as LexicalTextNode | undefined;
            if (!firstChild || typeof firstChild !== "object") return null;
            if (
              firstChild.type === "paragraph" ||
              firstChild.type === "heading" ||
              firstChild.type === "quote"
            ) {
              return {
                ...firstChild,
                format: normalizeBlockAlignment(firstChild.format ?? child.format),
              };
            }
            return firstChild;
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
      format: normalizeBlockAlignment(existing.format),
      children: (existing.children ?? []).map((child) => {
        if (!child || child.type !== "listitem") return child;
        const align = normalizeBlockAlignment(child.format ?? existing.format);
        return {
          ...child,
          format: align,
          children: (child.children ?? []).map((grandChild) => {
            if (
              grandChild?.type === "paragraph" ||
              grandChild?.type === "heading" ||
              grandChild?.type === "quote"
            ) {
              return { ...grandChild, format: align };
            }
            return grandChild;
          }),
        };
      }),
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
    format: inheritedAlignment,
    children: rootChildren.map((node, index) => ({
      type: "listitem",
      value: index + 1,
      format: inheritedAlignment,
      children: [
        node?.type === "paragraph" || node?.type === "heading" || node?.type === "quote"
          ? { ...node, format: inheritedAlignment }
          : node,
      ],
    })),
  };

  clone.root = {
    ...clone.root,
    children: [wrappedList],
  };
  return clone;
}

export function hasRootListType(lexical: unknown, listType: "bullet" | "number") {
  const rootChildren = cloneLexicalState(lexical).root?.children;
  return (
    Array.isArray(rootChildren) &&
    rootChildren.length === 1 &&
    rootChildren[0]?.type === "list" &&
    rootChildren[0]?.listType === listType
  );
}

function normalizeBlockAlignment(value: unknown): BlockAlignment {
  if (value === "center" || value === "right" || value === "justify") {
    return value;
  }
  return "left";
}

export function getBlockAlignment(lexical: unknown): BlockAlignment {
  const clone = cloneLexicalState(lexical);
  let detected: BlockAlignment | null = null;
  const visit = (nodes: LexicalTextNode[] | undefined) => {
    if (!Array.isArray(nodes) || detected) return;
    for (const node of nodes) {
      if (detected) break;
      if (
        node?.type === "paragraph" ||
        node?.type === "heading" ||
        node?.type === "quote" ||
        node?.type === "list" ||
        node?.type === "listitem"
      ) {
        detected = normalizeBlockAlignment(node.format);
      }
      visit(node?.children);
    }
  };
  visit(clone.root?.children);
  return detected ?? "left";
}

export function setBlockAlignmentOnAll(lexical: unknown, align: BlockAlignment) {
  const clone = cloneLexicalState(lexical);
  const visit = (nodes: LexicalTextNode[] | undefined) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (
        node?.type === "paragraph" ||
        node?.type === "heading" ||
        node?.type === "quote" ||
        node?.type === "list" ||
        node?.type === "listitem"
      ) {
        node.format = align;
      }
      visit(node?.children);
    }
  };
  visit(clone.root?.children);
  return clone;
}

export function setLinkOnAllBlocks(lexical: unknown, url: string | null) {
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
      if (
        node.type === "paragraph" ||
        node.type === "heading" ||
        node.type === "quote" ||
        node.type === "listitem"
      ) {
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

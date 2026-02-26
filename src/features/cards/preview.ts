import type { RichTextBlock, SideModel } from "./side-model/types";

export function extractFrontSearchText(side: SideModel | undefined) {
  if (!side) {
    return "";
  }

  return side.elements
    .filter((element): element is RichTextBlock => element.type === "richText")
    .map((textBlock) => {
      if (!textBlock.lexical || typeof textBlock.lexical !== "object") {
        return "";
      }

      const root = (textBlock.lexical as { root?: { children?: unknown[] } }).root;
      if (!Array.isArray(root?.children)) {
        return "";
      }

      return collectLexicalText(root.children).trim();
    })
    .filter((text) => text.length > 0)
    .join(" ")
    .trim();
}

function collectLexicalText(nodes: unknown[]): string {
  return nodes
    .map((node) => {
      if (!node || typeof node !== "object") {
        return "";
      }
      const lexicalNode = node as { text?: unknown; children?: unknown[] };
      if (typeof lexicalNode.text === "string") {
        return lexicalNode.text;
      }
      if (Array.isArray(lexicalNode.children)) {
        return collectLexicalText(lexicalNode.children);
      }
      return "";
    })
    .join(" ");
}

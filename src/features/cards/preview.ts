import type { RichTextBlock, SideModel } from "./side-model/types";

export function extractFrontPreview(side: SideModel | undefined) {
  if (!side) {
    return "Empty side";
  }

  const textBlock = side.elements.find((el): el is RichTextBlock => el.type === "richText");
  if (textBlock?.lexical && typeof textBlock.lexical === "object") {
    const root = (textBlock.lexical as { root?: { children?: unknown[] } }).root;
    if (Array.isArray(root?.children)) {
      const text = collectLexicalText(root.children).trim();
      if (text) {
        return text.slice(0, 72);
      }
    }
  }

  const image = side.elements.find((el) => el.type === "image");
  if (image) return "Image";

  const embed = side.elements.find((el) => el.type === "embed");
  if (embed) return "Video embed";

  const stroke = side.elements.find((el) => el.type === "stroke");
  if (stroke) return "Drawing";

  return "Empty side";
}

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

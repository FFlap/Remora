import type { SideIR } from "./side-ir/types";

export function extractFrontPreview(side: SideIR | undefined) {
  if (!side) {
    return "Empty side";
  }

  const textBlock = side.elements.find((el) => el.type === "richText") as
    | { lexical?: any }
    | undefined;

  if (textBlock?.lexical?.root?.children) {
    const text = collectLexicalText(textBlock.lexical.root.children).trim();
    if (text) {
      return text.slice(0, 72);
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

function collectLexicalText(nodes: any[]): string {
  return nodes
    .map((node) => {
      if (typeof node.text === "string") {
        return node.text;
      }
      if (Array.isArray(node.children)) {
        return collectLexicalText(node.children);
      }
      return "";
    })
    .join(" ");
}

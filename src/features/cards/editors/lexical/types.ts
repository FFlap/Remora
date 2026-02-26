export type TextAlignment = "left" | "center" | "right" | "justify";

export type FormatState = {
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  fontSize: string;
  alignment: TextAlignment;
};

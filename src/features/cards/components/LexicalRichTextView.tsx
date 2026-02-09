import type { CSSProperties, ReactNode } from "react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

type LexicalNode = {
  type?: string;
  tag?: string;
  text?: string;
  url?: string;
  style?: string;
  format?: number | string;
  children?: LexicalNode[];
  listType?: "bullet" | "number";
};

type LexicalRoot = {
  root?: {
    children?: LexicalNode[];
  };
};

function sanitizeLinkUrl(url: string | undefined): string | null {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return null;

  const schemeMatch = /^([a-zA-Z][a-zA-Z\d+\-.]*):/.exec(trimmed);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme === "http" || scheme === "https" || scheme === "mailto" || scheme === "tel") {
      return trimmed;
    }
    return null;
  }

  // Allow safe relative/hash links.
  if (
    trimmed.startsWith("#") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../")
  ) {
    return trimmed;
  }

  // Default bare domains/hosts to https.
  return `https://${trimmed}`;
}

function asScale(scale: number) {
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return scale;
}

function parseStyleString(style: string | undefined, scale: number): CSSProperties {
  if (!style) return {};
  const result: CSSProperties = {};
  const safeScale = asScale(scale);

  const entries = style
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [rawKey, ...rawValue] = chunk.split(":");
      return [rawKey?.trim().toLowerCase(), rawValue.join(":").trim()] as const;
    });

  for (const [key, value] of entries) {
    if (!key || !value) continue;

    if (key === "color") {
      result.color = value;
      continue;
    }

    if (key === "background-color") {
      result.backgroundColor = value;
      continue;
    }

    if (key === "font-size") {
      const px = Number.parseFloat(value);
      if (Number.isFinite(px)) {
        result.fontSize = `${Math.max(1, px * safeScale)}px`;
      }
      continue;
    }

    if (key === "font-family") {
      result.fontFamily = value;
      continue;
    }

    if (key === "font-weight") {
      result.fontWeight = value;
      continue;
    }

    if (key === "font-style") {
      result.fontStyle = value;
      continue;
    }

    if (key === "text-decoration") {
      result.textDecoration = value;
      continue;
    }
  }

  return result;
}

function textDecorationValue(hasUnderline: boolean, hasStrike: boolean) {
  if (hasUnderline && hasStrike) return "underline line-through";
  if (hasUnderline) return "underline";
  if (hasStrike) return "line-through";
  return undefined;
}

function formatToStyle(format: unknown): CSSProperties {
  const numeric = typeof format === "number" ? format : Number.parseInt(String(format ?? 0), 10);
  if (!Number.isFinite(numeric)) return {};

  const isBold = (numeric & 1) !== 0;
  const isItalic = (numeric & 2) !== 0;
  const isStrikethrough = (numeric & 4) !== 0;
  const isUnderline = (numeric & 8) !== 0;
  const isSubscript = (numeric & 32) !== 0;
  const isSuperscript = (numeric & 64) !== 0;

  const style: CSSProperties = {};
  if (isBold) style.fontWeight = 700;
  if (isItalic) style.fontStyle = "italic";

  const textDecoration = textDecorationValue(isUnderline, isStrikethrough);
  if (textDecoration) style.textDecoration = textDecoration;

  if (isSubscript) style.verticalAlign = "sub";
  if (isSuperscript) style.verticalAlign = "super";

  return style;
}

function paragraphAlign(format: unknown): CSSProperties["textAlign"] | undefined {
  if (typeof format !== "string") return undefined;
  if (format === "left" || format === "center" || format === "right" || format === "justify") {
    return format;
  }
  return undefined;
}

function renderNode(node: LexicalNode, key: string, scale: number): ReactNode {
  const baseFontSizePx = `${Math.max(1, 16 * asScale(scale))}px`;
  const children = Array.isArray(node.children)
    ? node.children.map((child, index) => renderNode(child, `${key}-${index}`, scale))
    : null;

  switch (node.type) {
    case "linebreak":
      return <br key={key} />;

    case "text": {
      const inlineStyle = {
        ...formatToStyle(node.format),
        ...parseStyleString(node.style, scale),
      };

      if (inlineStyle.fontSize == null) {
        inlineStyle.fontSize = `${Math.max(1, 16 * asScale(scale))}px`;
      }

      return (
        <span key={key} style={inlineStyle}>
          {node.text ?? ""}
        </span>
      );
    }

    case "paragraph":
      return (
        <p
          key={key}
          className="mb-[var(--lexical-block-spacing)] last:mb-0 leading-[1.35]"
          style={{ textAlign: paragraphAlign(node.format), fontSize: baseFontSizePx }}
        >
          {children}
        </p>
      );

    case "heading": {
      const tag = node.tag === "h1" || node.tag === "h2" || node.tag === "h3" ? node.tag : "h2";
      const size =
        tag === "h1" ? Math.max(1, 28 * asScale(scale)) : tag === "h2" ? Math.max(1, 24 * asScale(scale)) : Math.max(1, 20 * asScale(scale));
      return (
        <p
          key={key}
          className="mb-[var(--lexical-block-spacing)] last:mb-0 font-semibold leading-tight"
          style={{ fontSize: `${size}px` }}
        >
          {children}
        </p>
      );
    }

    case "list":
      if (node.listType === "number") {
        return (
          <ol
            key={key}
            className="mb-[var(--lexical-block-spacing)] list-decimal pl-[var(--lexical-list-indent)] text-left inline-block leading-[1.35]"
            style={{ fontSize: baseFontSizePx }}
          >
            {children}
          </ol>
        );
      }
      return (
        <ul
          key={key}
          className="mb-[var(--lexical-block-spacing)] list-disc pl-[var(--lexical-list-indent)] text-left inline-block leading-[1.35]"
          style={{ fontSize: baseFontSizePx }}
        >
          {children}
        </ul>
      );

    case "listitem":
      return (
        <li key={key} className="mb-[var(--lexical-list-item-spacing)] last:mb-0">
          {children}
        </li>
      );

    case "quote":
      return (
        <blockquote
          key={key}
          className="mb-[var(--lexical-block-spacing)] border-l-2 border-zinc-300 pl-[var(--lexical-quote-indent)] italic text-zinc-600 last:mb-0"
          style={{ fontSize: baseFontSizePx }}
        >
          {children}
        </blockquote>
      );

    case "link":
      {
        const safeHref = sanitizeLinkUrl(node.url);
        if (!safeHref) {
          return <span key={key}>{children}</span>;
        }

        const isHttpLink = /^https?:\/\//i.test(safeHref);
        return (
          <a
            key={key}
            href={safeHref}
            className="text-blue-600 underline"
            target={isHttpLink ? "_blank" : undefined}
            rel={isHttpLink ? "noopener noreferrer nofollow ugc" : undefined}
          >
            {children}
          </a>
        );
      }

    default:
      if (children && children.length > 0) {
        return <Fragment key={key}>{children}</Fragment>;
      }
      return null;
  }
}

export function lexicalHasRenderableText(lexical: unknown) {
  const root = (lexical as LexicalRoot | undefined)?.root;
  if (!root || !Array.isArray(root.children)) return false;

  const visit = (nodes: LexicalNode[]): boolean => {
    for (const node of nodes) {
      if (node.type === "text" && typeof node.text === "string" && node.text.trim().length > 0) {
        return true;
      }
      if (Array.isArray(node.children) && visit(node.children)) {
        return true;
      }
    }
    return false;
  };

  return visit(root.children);
}

export function LexicalRichTextView({
  lexical,
  scale = 1,
  className,
  placeholder = "Text",
  dataTestId,
  scrollOnHover = false,
}: {
  lexical: unknown;
  scale?: number;
  className?: string;
  placeholder?: string;
  dataTestId?: string;
  scrollOnHover?: boolean;
}) {
  const root = (lexical as LexicalRoot | undefined)?.root;
  const children = Array.isArray(root?.children) ? root.children : [];
  const hasText = lexicalHasRenderableText(lexical);
  const safeScale = asScale(scale);
  const previewStyle: CSSProperties & Record<string, string> = {
    "--lexical-block-spacing": `${Math.max(1, 8 * safeScale)}px`,
    "--lexical-list-indent": `${Math.max(1, 20 * safeScale)}px`,
    "--lexical-list-item-spacing": `${Math.max(1, 4 * safeScale)}px`,
    "--lexical-quote-indent": `${Math.max(1, 12 * safeScale)}px`,
  };

  return (
    <div
      className={cn(
        "h-full w-full whitespace-pre-wrap break-words text-[#0f172a]",
        scrollOnHover ? "remora-preview-scroll overflow-y-auto overflow-x-hidden" : "overflow-hidden",
        className,
      )}
      data-testid={dataTestId}
      style={previewStyle}
      onWheel={
        scrollOnHover
          ? (event) => {
              const node = event.currentTarget;
              if (node.scrollHeight <= node.clientHeight + 1) return;
              node.scrollTop += event.deltaY;
              event.stopPropagation();
            }
          : undefined
      }
    >
      {hasText ? (
        children.map((node, index) => renderNode(node, `node-${index}`, scale))
      ) : (
        <span className="text-[#64748b]" style={{ fontSize: `${Math.max(1, 16 * asScale(scale))}px` }}>
          {placeholder}
        </span>
      )}
    </div>
  );
}

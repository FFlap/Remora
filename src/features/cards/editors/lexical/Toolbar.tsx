import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $patchStyleText } from "@lexical/selection";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
} from "lexical";
import { ImagePlus, Link2, List, ListOrdered, Table, Youtube } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { AlignmentDropdown } from "./alignment-controls";
import type { FormatState } from "./types";

function normalizeHttpUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`,
    );
    return parsed.toString();
  } catch {
    return null;
  }
}

function contrastTextColor(hexColor: string) {
  const normalized = hexColor.replace("#", "");
  if (normalized.length !== 6) return "#ffffff";
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return "#ffffff";
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? "#111827" : "#ffffff";
}

type ToolbarProps = {
  formatState: FormatState;
  onImageInsert?: () => void;
  onYouTubeInsert?: () => void;
  showTableButton?: boolean;
};

type InsertButtonsProps = {
  showTableButton: boolean;
  onYouTubeInsert?: () => void;
  onImageInsert?: () => void;
  onInsertTable: () => void;
};

const iconButtonClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground";

function ToolbarTextColorControl({
  textColor,
  onChange,
}: {
  textColor: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="ml-1 flex items-center gap-1.5">
      <label className="relative block h-7 w-7 overflow-hidden rounded-md border border-border">
        <input
          type="color"
          value={textColor}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          title="Text Color"
        />
        <span
          className="flex h-full w-full items-center justify-center text-xs font-semibold leading-none"
          style={{ backgroundColor: textColor, color: contrastTextColor(textColor) }}
        >
          A
        </span>
      </label>
    </div>
  );
}

function ToolbarOptionalButton({
  visible,
  title,
  onClick,
  children,
}: {
  visible: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  if (!visible) return null;
  return (
    <button
      type="button"
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

function ToolbarInsertButtons({
  showTableButton,
  onYouTubeInsert,
  onImageInsert,
  onInsertTable,
}: InsertButtonsProps) {
  return (
    <>
      <ToolbarOptionalButton
        visible={Boolean(onYouTubeInsert)}
        onClick={() => onYouTubeInsert?.()}
        title="Add YouTube"
      >
        <Youtube className="h-4 w-4" />
      </ToolbarOptionalButton>

      <ToolbarOptionalButton
        visible={Boolean(onImageInsert)}
        onClick={() => onImageInsert?.()}
        title="Add Image"
      >
        <ImagePlus className="h-4 w-4" />
      </ToolbarOptionalButton>

      {showTableButton ? (
        <button
          type="button"
          className={iconButtonClass}
          onClick={onInsertTable}
          title="Insert Table"
        >
          <Table className="h-4 w-4" />
        </button>
      ) : null}
    </>
  );
}

export function Toolbar({
  formatState,
  onImageInsert,
  onYouTubeInsert,
  showTableButton = true,
}: ToolbarProps) {
  const [editor] = useLexicalComposerContext();
  const [textColor, setTextColor] = useState("#111827");
  const alignmentValue = formatState.alignment;

  const onInsertTable = useCallback(
    () =>
      editor.dispatchCommand(INSERT_TABLE_COMMAND, {
        columns: "2",
        rows: "2",
        includeHeaders: false,
      }),
    [editor],
  );

  const applyFontSize = useCallback(
    (value: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $patchStyleText(selection, { "font-size": value });
        }
      });
    },
    [editor],
  );

  const applyTextColor = useCallback(
    (value: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $patchStyleText(selection, { color: value });
        }
      });
      setTextColor(value);
    },
    [editor],
  );

  const insertLink = useCallback(() => {
    const raw = window.prompt("Enter URL", "https://");
    if (!raw) return;
    const safe = normalizeHttpUrl(raw);
    if (!safe) {
      window.alert("Enter a valid URL.");
      return;
    }
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, safe);
  }, [editor]);

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border bg-muted/50 p-1.5">
      <button
        type="button"
        data-active={formatState.isBold}
        className={iconButtonClass}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
        title="Bold"
      >
        <span className="text-[13px] font-semibold">B</span>
      </button>
      <button
        type="button"
        data-active={formatState.isItalic}
        className={iconButtonClass}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
        title="Italic"
      >
        <span className="text-[13px] italic">I</span>
      </button>
      <button
        type="button"
        data-active={formatState.isUnderline}
        className={iconButtonClass}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
        title="Underline"
      >
        <span className="text-[13px] underline">U</span>
      </button>
      <button
        type="button"
        data-active={formatState.isStrikethrough}
        className={iconButtonClass}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")}
        title="Strikethrough"
      >
        <span className="text-[13px] line-through">S</span>
      </button>

      <div className="mx-1 h-6 w-px bg-border" />

      <select
        value={formatState.fontSize}
        onChange={(event) => applyFontSize(event.target.value)}
        className="h-7 min-w-[58px] rounded-md border border-border bg-background px-1.5 text-xs"
        title="Font size"
      >
        {["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"].map((size) => (
          <option key={size} value={size}>
            {size.replace("px", "")}
          </option>
        ))}
      </select>

      <AlignmentDropdown
        value={alignmentValue}
        onChange={(next) => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, next)}
        triggerClassName={iconButtonClass}
      />
      <div className="mx-1 h-6 w-px bg-border" />

      <button
        type="button"
        className={iconButtonClass}
        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={iconButtonClass}
        onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </button>
      <div className="mx-1 h-6 w-px bg-border" />
      <button type="button" className={iconButtonClass} onClick={insertLink} title="Insert Link">
        <Link2 className="h-4 w-4" />
      </button>

      <ToolbarInsertButtons
        showTableButton={showTableButton}
        onYouTubeInsert={onYouTubeInsert}
        onImageInsert={onImageInsert}
        onInsertTable={onInsertTable}
      />

      <ToolbarTextColorControl textColor={textColor} onChange={applyTextColor} />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState, type WheelEvent } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  $getSelection,
  $isRangeSelection,
  type EditorState,
} from "lexical";
import {
  INSERT_TABLE_COMMAND,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import { ListItemNode, ListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { LinkNode, AutoLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { $patchStyleText, $getSelectionStyleValueForProperty } from "@lexical/selection";
import { AlignCenter, ImagePlus, Link2, List, ListOrdered, Table, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";

type FormatState = {
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  fontSize: string;
};

function normalizeHttpUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`);
    return parsed.toString();
  } catch {
    return null;
  }
}

function FormatStatePlugin({
  onFormatChange,
}: {
  onFormatChange: (state: FormatState) => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          onFormatChange({
            isBold: false,
            isItalic: false,
            isUnderline: false,
            isStrikethrough: false,
            fontSize: "16px",
          });
          return;
        }

        const fontSize = $getSelectionStyleValueForProperty(selection, "font-size", "16px") ?? "16px";
        onFormatChange({
          isBold: selection.hasFormat("bold"),
          isItalic: selection.hasFormat("italic"),
          isUnderline: selection.hasFormat("underline"),
          isStrikethrough: selection.hasFormat("strikethrough"),
          fontSize,
        });
      });
    });
  }, [editor, onFormatChange]);

  return null;
}

function SyncExternalStatePlugin({
  serializedValue,
  lastLocalChangeRef,
}: {
  serializedValue: string;
  lastLocalChangeRef: React.MutableRefObject<string>;
}) {
  const [editor] = useLexicalComposerContext();
  const lastAppliedRef = useRef("");

  useEffect(() => {
    if (!serializedValue) return;

    if (serializedValue === lastAppliedRef.current) {
      return;
    }

    if (serializedValue === lastLocalChangeRef.current) {
      lastAppliedRef.current = serializedValue;
      return;
    }

    queueMicrotask(() => {
      try {
        const nextState = editor.parseEditorState(serializedValue);
        editor.setEditorState(nextState);
        lastAppliedRef.current = serializedValue;
      } catch {
        // Ignore invalid serialized states.
      }
    });
  }, [editor, serializedValue, lastLocalChangeRef]);

  return null;
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

function scrollOnHoverWheel(event: WheelEvent<HTMLDivElement>) {
  const host = event.currentTarget;
  const editable = host.querySelector('[contenteditable="true"]') as HTMLElement | null;
  const candidates: HTMLElement[] = [];
  if (editable) candidates.push(editable);
  candidates.push(host);

  const target = candidates.find((node) => node.scrollHeight > node.clientHeight + 1);
  if (!target) return;

  target.scrollTop += event.deltaY;
  event.stopPropagation();
}

function Toolbar({
  formatState,
  onImageInsert,
  onYouTubeInsert,
  showTableButton = true,
}: {
  formatState: FormatState;
  onImageInsert?: () => void;
  onYouTubeInsert?: () => void;
  showTableButton?: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const [textColor, setTextColor] = useState("#111827");

  const iconButtonClass =
    "inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground";

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

      <button
        type="button"
        className={iconButtonClass}
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center")}
        title="Align Center"
      >
        <AlignCenter className="h-4 w-4" />
      </button>
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
      <button
        type="button"
        className={iconButtonClass}
        onClick={insertLink}
        title="Insert Link"
      >
        <Link2 className="h-4 w-4" />
      </button>

      {onYouTubeInsert && (
        <button
          type="button"
          className={iconButtonClass}
          onClick={onYouTubeInsert}
          title="Add YouTube"
        >
          <Youtube className="h-4 w-4" />
        </button>
      )}

      {onImageInsert && (
        <button
          type="button"
          className={iconButtonClass}
          onClick={onImageInsert}
          title="Add Image"
        >
          <ImagePlus className="h-4 w-4" />
        </button>
      )}

      {showTableButton && (
        <button
          type="button"
          className={iconButtonClass}
          onClick={() =>
            editor.dispatchCommand(INSERT_TABLE_COMMAND, {
              columns: "2",
              rows: "2",
              includeHeaders: false,
            })
          }
          title="Insert Table"
        >
          <Table className="h-4 w-4" />
        </button>
      )}

      <div className="ml-1 flex items-center gap-1.5">
        <label className="relative block h-7 w-7 overflow-hidden rounded-md border border-border">
          <input
            type="color"
            value={textColor}
            onChange={(event) => applyTextColor(event.target.value)}
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
    </div>
  );
}

export function LexicalRichTextEditor({
  editorKey,
  value,
  onChange,
  onImageInsert,
  onYouTubeInsert,
  variant = "panel",
  showToolbar = true,
  showTableButton = true,
  panelScrollable = false,
  placeholder = "Start writing...",
  className,
}: {
  editorKey: string;
  value: unknown;
  onChange: (nextValue: unknown) => void;
  onImageInsert?: () => void;
  onYouTubeInsert?: () => void;
  variant?: "panel" | "inline";
  showToolbar?: boolean;
  showTableButton?: boolean;
  panelScrollable?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const serializedValue = useMemo(() => JSON.stringify(value), [value]);
  const lastLocalChangeRef = useRef(serializedValue);
  const isInline = variant === "inline";
  const isPanelScrollable = !isInline && panelScrollable;
  const [formatState, setFormatState] = useState<FormatState>({
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrikethrough: false,
    fontSize: "16px",
  });

  const initialConfig = {
    namespace: `remora-quick-${editorKey}`,
    editorState: serializedValue,
    onError(error: Error) {
      throw error;
    },
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      LinkNode,
      AutoLinkNode,
      TableNode,
      TableCellNode,
      TableRowNode,
    ],
    theme: {
      paragraph: "mb-2 last:mb-0 leading-[1.35]",
      heading: {
        h1: "text-[1.5em] font-bold mb-[0.5em]",
        h2: "text-[1.25em] font-semibold mb-[0.5em]",
        h3: "text-[1.1em] font-medium mb-[0.5em]",
      },
      list: {
        ul: "list-disc mb-[0.5em] pl-[1.25em] text-left inline-block",
        ol: "list-decimal mb-[0.5em] pl-[1.25em] text-left inline-block",
        listitem: "mb-[0.25em]",
      },
      text: {
        bold: "font-bold",
        italic: "italic",
        underline: "underline",
        strikethrough: "line-through",
      },
      quote: "border-l-4 border-border pl-[1em] italic text-muted-foreground",
      link: "text-blue-600 underline hover:text-blue-800 cursor-pointer",
    },
  };

  const handleChange = useCallback(
    (editorState: EditorState) => {
      const next = JSON.stringify(editorState.toJSON());
      lastLocalChangeRef.current = next;
      onChange(JSON.parse(next) as unknown);
    },
    [onChange],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className={cn(
          "rounded-lg border border-input bg-background",
          isInline ? "flex h-full w-full min-h-0 flex-col overflow-hidden" : "overflow-hidden",
          !showToolbar && isInline ? "rounded-none border-0 bg-transparent shadow-none" : "",
          className,
        )}
      >
        {showToolbar && (
          <Toolbar
            formatState={formatState}
            onImageInsert={onImageInsert}
            onYouTubeInsert={onYouTubeInsert}
            showTableButton={showTableButton}
          />
        )}
        <div
          className={cn("relative", isInline ? "min-h-0 flex-1 overflow-auto" : "")}
          style={isInline || isPanelScrollable ? { scrollbarGutter: "stable" } : undefined}
          onWheel={scrollOnHoverWheel}
        >
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className={cn(
                  "text-foreground outline-none",
                  isInline
                    ? "h-full min-h-0 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words p-0 leading-[1.35]"
                    : isPanelScrollable
                      ? "h-[360px] overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words p-4 text-base leading-[1.45]"
                      : "min-h-[230px] p-4 text-base leading-[1.45]",
                )}
                style={isInline || isPanelScrollable ? { scrollbarGutter: "stable" } : undefined}
              />
            }
            placeholder={
              <div
                className={cn(
                  "pointer-events-none absolute text-sm text-muted-foreground",
                  isInline ? "left-0 top-0 leading-[1.35]" : "left-4 top-4",
                )}
              >
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <TablePlugin />
          <OnChangePlugin onChange={handleChange} />
          <FormatStatePlugin onFormatChange={setFormatState} />
          <SyncExternalStatePlugin
            serializedValue={serializedValue}
            lastLocalChangeRef={lastLocalChangeRef}
          />
        </div>
      </div>
    </LexicalComposer>
  );
}

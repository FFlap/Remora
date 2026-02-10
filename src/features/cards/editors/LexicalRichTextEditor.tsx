import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $getSelectionStyleValueForProperty } from "@lexical/selection";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { $getSelection, $isRangeSelection, type EditorState } from "lexical";
import { useCallback, useEffect, useMemo, useRef, useState, type WheelEvent } from "react";
import { cn } from "@/lib/utils";
import { Toolbar } from "./lexical/Toolbar";
import type { FormatState } from "./lexical/types";

function normalizeSelectionAlignment(value: string | null | undefined): FormatState["alignment"] {
  if (value === "center" || value === "right" || value === "justify") {
    return value;
  }
  return "left";
}

function FormatStatePlugin({ onFormatChange }: { onFormatChange: (state: FormatState) => void }) {
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
            alignment: "left",
          });
          return;
        }

        const fontSize =
          $getSelectionStyleValueForProperty(selection, "font-size", "16px") ?? "16px";
        const alignment = normalizeSelectionAlignment(
          selection.anchor.getNode().getTopLevelElementOrThrow().getFormatType(),
        );
        onFormatChange({
          isBold: selection.hasFormat("bold"),
          isItalic: selection.hasFormat("italic"),
          isUnderline: selection.hasFormat("underline"),
          isStrikethrough: selection.hasFormat("strikethrough"),
          fontSize,
          alignment,
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
    if (!serializedValue || serializedValue === lastAppliedRef.current) {
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

function createInitialConfig(editorKey: string, serializedValue: string) {
  return {
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
}

function getEditableClassName(isInline: boolean, isPanelScrollable: boolean) {
  if (isInline) {
    return "h-full min-h-0 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words p-0 leading-[1.35]";
  }

  if (isPanelScrollable) {
    return "h-[360px] overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words p-4 text-base leading-[1.45]";
  }

  return "min-h-[230px] p-4 text-base leading-[1.45]";
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
  const editableClassName = getEditableClassName(isInline, isPanelScrollable);
  const [formatState, setFormatState] = useState<FormatState>({
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrikethrough: false,
    fontSize: "16px",
    alignment: "left",
  });

  const initialConfig = useMemo(
    () => createInitialConfig(editorKey, serializedValue),
    [editorKey, serializedValue],
  );

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
        {showToolbar ? (
          <Toolbar
            formatState={formatState}
            onImageInsert={onImageInsert}
            onYouTubeInsert={onYouTubeInsert}
            showTableButton={showTableButton}
          />
        ) : null}
        <div
          className={cn("relative", isInline ? "min-h-0 flex-1 overflow-auto" : "")}
          style={isInline || isPanelScrollable ? { scrollbarGutter: "stable" } : undefined}
          onWheel={scrollOnHoverWheel}
        >
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className={cn("text-foreground outline-none", editableClassName)}
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

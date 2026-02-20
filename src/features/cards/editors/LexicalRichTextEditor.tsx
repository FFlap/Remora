import { AutoLinkNode, LinkNode } from "@lexical/link";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from "@lexical/list";
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
import {
  $getSelection,
  $isRangeSelection,
  type EditorState,
  FORMAT_ELEMENT_COMMAND,
} from "lexical";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent,
} from "react";
import { cn } from "@/lib/utils";
import { Toolbar } from "./lexical/Toolbar";
import type { FormatState, TextAlignment } from "./lexical/types";

export type LexicalRichTextEditorApi = {
  applyAlignment: (alignment: TextAlignment) => void;
  toggleList: (listType: "bullet" | "numbered") => void;
  focus: () => void;
};

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

function EditorApiPlugin({
  onEditorApi,
}: {
  onEditorApi?: (api: LexicalRichTextEditorApi | null) => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!onEditorApi) return;

    onEditorApi({
      applyAlignment: (alignment) => {
        editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, alignment);
      },
      toggleList: (listType) => {
        editor.dispatchCommand(
          listType === "numbered" ? INSERT_ORDERED_LIST_COMMAND : INSERT_UNORDERED_LIST_COMMAND,
          undefined,
        );
      },
      focus: () => {
        editor.focus();
      },
    });

    return () => {
      onEditorApi(null);
    };
  }, [editor, onEditorApi]);

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
  const maxScrollTop = target.scrollHeight - target.clientHeight;
  if (maxScrollTop <= 1) return;

  const deltaY = event.deltaY;
  if (deltaY === 0) return;

  const atTop = target.scrollTop <= 1;
  const atBottom = target.scrollTop >= maxScrollTop - 1;
  if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) return;

  event.preventDefault();
  target.scrollTop = Math.min(maxScrollTop, Math.max(0, target.scrollTop + deltaY));
  event.stopPropagation();
}

function createInitialConfig(editorKey: string, serializedValue: string, isInline: boolean) {
  const inlineTheme = {
    paragraph: "mb-[var(--lexical-block-spacing)] last:mb-0 leading-[1.35]",
    heading: {
      h1: "mb-[var(--lexical-block-spacing)] text-[28px] font-semibold leading-tight",
      h2: "mb-[var(--lexical-block-spacing)] text-[24px] font-semibold leading-tight",
      h3: "mb-[var(--lexical-block-spacing)] text-[20px] font-semibold leading-tight",
    },
    list: {
      ul: "mb-[var(--lexical-block-spacing)] list-disc list-inside pl-[var(--lexical-list-indent)] leading-[1.35]",
      ol: "mb-[var(--lexical-block-spacing)] list-decimal list-inside pl-[var(--lexical-list-indent)] leading-[1.35]",
      listitem: "mb-[var(--lexical-list-item-spacing)] last:mb-0",
    },
    text: {
      bold: "font-bold",
      italic: "italic",
      underline: "underline",
      strikethrough: "line-through",
    },
    quote:
      "mb-[var(--lexical-block-spacing)] border-l-2 border-zinc-300 pl-[var(--lexical-quote-indent)] italic text-zinc-600 last:mb-0",
    link: "text-blue-600 underline",
  };

  const panelTheme = {
    paragraph: "mb-2 last:mb-0 leading-[1.35]",
    heading: {
      h1: "text-[1.5em] font-bold mb-[0.5em]",
      h2: "text-[1.25em] font-semibold mb-[0.5em]",
      h3: "text-[1.1em] font-medium mb-[0.5em]",
    },
    list: {
      ul: "list-disc list-inside mb-[0.5em] pl-[1.25em]",
      ol: "list-decimal list-inside mb-[0.5em] pl-[1.25em]",
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
  };

  return {
    namespace: `remora-quick-${editorKey}`,
    ...(serializedValue ? { editorState: serializedValue } : {}),
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
    theme: isInline ? inlineTheme : panelTheme,
  };
}

function getEditableClassName(isInline: boolean, isPanelScrollable: boolean) {
  if (isInline) {
    return "my-auto w-full min-h-0 whitespace-pre-wrap break-words p-0 leading-[1.35]";
  }

  if (isPanelScrollable) {
    return "remora-lexical-panel-scroll overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words p-4 text-base leading-[1.45]";
  }

  return "min-h-[230px] p-4 text-base leading-[1.45]";
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Editor composes Lexical setup, toolbar options, and plugin wiring in one render path.
export function LexicalRichTextEditor({
  editorKey,
  value,
  onChange,
  onImageInsert,
  onYouTubeInsert,
  textBlockOptions,
  activeTextBlockId,
  onActiveTextBlockChange,
  cardBackgroundColor,
  onCardBackgroundChange,
  cardBackgroundColorInputTestId,
  onEditorApi,
  variant = "panel",
  frameRounded = true,
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
  textBlockOptions?: Array<{ id: string; label: string }>;
  activeTextBlockId?: string;
  onActiveTextBlockChange?: (id: string) => void;
  cardBackgroundColor?: string;
  onCardBackgroundChange?: (value: string) => void;
  cardBackgroundColorInputTestId?: string;
  onEditorApi?: (api: LexicalRichTextEditorApi | null) => void;
  variant?: "panel" | "inline";
  frameRounded?: boolean;
  showToolbar?: boolean;
  showTableButton?: boolean;
  panelScrollable?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const serializedValue = useMemo(() => {
    if (typeof value === "string") {
      return value;
    }
    if (value == null) {
      return "";
    }
    return JSON.stringify(value);
  }, [value]);
  const lastLocalChangeRef = useRef(serializedValue);
  const initialSerializedValueRef = useRef(serializedValue);
  const contentEditableRef = useRef<HTMLDivElement | null>(null);
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
    () => createInitialConfig(editorKey, initialSerializedValueRef.current, isInline),
    [editorKey, isInline],
  );

  const handleChange = useCallback(
    (editorState: EditorState) => {
      const next = JSON.stringify(editorState.toJSON());
      lastLocalChangeRef.current = next;
      onChange(JSON.parse(next) as unknown);
    },
    [onChange],
  );

  const placeholderPositionClassName = isInline
    ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center leading-[1.35]"
    : "left-4 top-4";
  const placeholderColorClassName = isInline ? "text-[#64748b]" : "text-muted-foreground";
  const lexicalStyleVars: CSSProperties & Record<string, string> = {
    "--lexical-block-spacing": "8px",
    "--lexical-list-indent": "20px",
    "--lexical-list-item-spacing": "4px",
    "--lexical-quote-indent": "12px",
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className={cn(
          "border border-input bg-background",
          frameRounded ? "rounded-lg" : "rounded-none",
          isInline ? "flex h-full w-full min-h-0 flex-col overflow-hidden" : "overflow-hidden",
          isPanelScrollable ? "flex min-h-0 flex-col" : "",
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
            textBlockOptions={textBlockOptions}
            activeTextBlockId={activeTextBlockId}
            onActiveTextBlockChange={onActiveTextBlockChange}
            cardBackgroundColor={cardBackgroundColor}
            onCardBackgroundChange={onCardBackgroundChange}
            cardBackgroundColorInputTestId={cardBackgroundColorInputTestId}
          />
        ) : null}
        <div
          className={cn(
            "relative",
            isPanelScrollable ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "",
            isInline
              ? "remora-lexical-inline-scroll-host remora-preview-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
              : "",
          )}
          style={lexicalStyleVars}
          onWheel={scrollOnHoverWheel}
        >
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                ref={contentEditableRef}
                className={cn(
                  "remora-lexical-content outline-none",
                  isInline ? "text-[#0f172a]" : "text-foreground",
                  editableClassName,
                )}
                style={isInline || isPanelScrollable ? { scrollbarGutter: "stable" } : undefined}
              />
            }
            placeholder={
              <div
                className={cn(
                  "pointer-events-none absolute text-sm",
                  placeholderColorClassName,
                  placeholderPositionClassName,
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
          <EditorApiPlugin onEditorApi={onEditorApi} />
          <SyncExternalStatePlugin
            serializedValue={serializedValue}
            lastLocalChangeRef={lastLocalChangeRef}
          />
        </div>
      </div>
    </LexicalComposer>
  );
}

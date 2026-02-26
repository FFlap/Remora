// biome-ignore lint/nursery/noExcessiveLinesPerFile: Parity matrix covers many content/alignment combinations in a single reusable fixture.
import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

type Alignment = "left" | "center" | "right" | "justify";
type ContentMode = "paragraph" | "bullet" | "numbered";

type SurfaceItemMetric = {
  text: string;
  align: Alignment;
  lineHeight: number | null;
  marginBottom: number | null;
  x: number;
  y: number;
  firstGlyphX: number | null;
  firstGlyphY: number | null;
};

type SurfaceBlockMetric =
  | {
      kind: "paragraph";
      text: string;
      align: Alignment;
      lineHeight: number | null;
      marginBottom: number | null;
      x: number;
      y: number;
      firstGlyphX: number | null;
      firstGlyphY: number | null;
    }
  | {
      kind: "list";
      listType: "bullet" | "numbered";
      align: Alignment;
      lineHeight: number | null;
      marginBottom: number | null;
      paddingLeft: number | null;
      listStyleType: string;
      x: number;
      y: number;
      items: SurfaceItemMetric[];
    };

type SurfaceSnapshot = {
  overflow: boolean;
  blocks: SurfaceBlockMetric[];
};

type ParityCase = {
  name: string;
  mode: ContentMode;
  alignment: Alignment;
  lines: string[];
  expectOverflow: boolean;
};

const MODIFIER_KEY = process.platform === "darwin" ? "Meta" : "Control";

const PARAGRAPH_FULL_LINES = Array.from(
  { length: 28 },
  (_, index) =>
    `Paragraph ${index + 1} :: ${"ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(2)} ${"1234567890".repeat(2)}`,
);

const LIST_FULL_LINES = Array.from(
  { length: 22 },
  (_, index) =>
    `List item ${index + 1} :: ${"loremipsumdolorsitamet".repeat(2)} ${"9876543210".repeat(2)}`,
);

const MARKDOWN_PARAGRAPH_LINES = [
  "# heading-like line",
  "**bold** _italic_ ~~strike~~ `inline-code`",
  "[link](https://example.com) with markdown-like syntax",
];

const MARKDOWN_LIST_LINES = [
  "**bullet one** with [link](https://example.com)",
  "_bullet two_ with `code` and ~~strike~~",
  "third bullet with # hash and * stars",
];

const CASES: ParityCase[] = [
  {
    name: "paragraph-left-full",
    mode: "paragraph",
    alignment: "left",
    lines: PARAGRAPH_FULL_LINES,
    expectOverflow: true,
  },
  {
    name: "paragraph-center-full",
    mode: "paragraph",
    alignment: "center",
    lines: PARAGRAPH_FULL_LINES,
    expectOverflow: true,
  },
  {
    name: "paragraph-right-full",
    mode: "paragraph",
    alignment: "right",
    lines: PARAGRAPH_FULL_LINES,
    expectOverflow: true,
  },
  {
    name: "paragraph-justify-full",
    mode: "paragraph",
    alignment: "justify",
    lines: PARAGRAPH_FULL_LINES,
    expectOverflow: true,
  },
  {
    name: "bullet-left-full",
    mode: "bullet",
    alignment: "left",
    lines: LIST_FULL_LINES,
    expectOverflow: true,
  },
  {
    name: "bullet-center-full",
    mode: "bullet",
    alignment: "center",
    lines: LIST_FULL_LINES,
    expectOverflow: true,
  },
  {
    name: "bullet-right-full",
    mode: "bullet",
    alignment: "right",
    lines: LIST_FULL_LINES,
    expectOverflow: true,
  },
  {
    name: "bullet-justify-full",
    mode: "bullet",
    alignment: "justify",
    lines: LIST_FULL_LINES,
    expectOverflow: true,
  },
  {
    name: "numbered-center-full",
    mode: "numbered",
    alignment: "center",
    lines: LIST_FULL_LINES,
    expectOverflow: true,
  },
  {
    name: "numbered-right-full",
    mode: "numbered",
    alignment: "right",
    lines: LIST_FULL_LINES,
    expectOverflow: true,
  },
  {
    name: "paragraph-center-markdown-syntax",
    mode: "paragraph",
    alignment: "center",
    lines: MARKDOWN_PARAGRAPH_LINES,
    expectOverflow: false,
  },
  {
    name: "bullet-right-markdown-syntax",
    mode: "bullet",
    alignment: "right",
    lines: MARKDOWN_LIST_LINES,
    expectOverflow: false,
  },
];

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Creative Preview Parity ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Double-click inline edit should match static preview");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

async function openInlineByToolbar(page: Parameters<typeof test>[0]["page"]) {
  await page.getByTestId("mode-creative-button").click();
  await expect(page.getByTestId("creative-card-canvas")).toBeVisible({ timeout: 12000 });

  const staticRichText = page
    .locator(
      '[data-testid^="creative-richtext-static-"]:not([data-testid="creative-richtext-static-layer"])',
    )
    .first();
  await expect(staticRichText).toBeVisible({ timeout: 12000 });
  await staticRichText.click({ force: true });

  const editButton = page.getByRole("button", { name: "Edit Text" });
  await expect(editButton).toBeVisible({ timeout: 12000 });
  await editButton.click();

  const inlineRoot = page.getByTestId("creative-inline-richtext-editor");
  await expect(inlineRoot).toBeVisible({ timeout: 12000 });
  await expect(inlineRoot.locator('[contenteditable="true"]').first()).toBeVisible({
    timeout: 12000,
  });
}

async function openInlineByDoubleClick(page: Parameters<typeof test>[0]["page"]) {
  const staticRichText = page
    .locator(
      '[data-testid^="creative-richtext-static-"]:not([data-testid="creative-richtext-static-layer"])',
    )
    .first();
  await expect(staticRichText).toBeVisible({ timeout: 12000 });
  await staticRichText.dblclick({ force: true });

  const inlineRoot = page.getByTestId("creative-inline-richtext-editor");
  await expect(inlineRoot).toBeVisible({ timeout: 12000 });
  await expect(inlineRoot.locator('[contenteditable="true"]').first()).toBeVisible({
    timeout: 12000,
  });
}

async function writeLinesToInlineEditor(page: Parameters<typeof test>[0]["page"], lines: string[]) {
  const editable = page
    .getByTestId("creative-inline-richtext-editor")
    .locator('[contenteditable="true"]')
    .first();
  await editable.click({ force: true });
  await page.keyboard.press(`${MODIFIER_KEY}+A`);
  await page.keyboard.press("Backspace");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.length > 0) {
      await page.keyboard.insertText(line);
    }
    if (index < lines.length - 1) {
      await page.keyboard.press("Enter");
    }
  }
}

async function applyModeAndAlignment(
  page: Parameters<typeof test>[0]["page"],
  mode: ContentMode,
  alignment: Alignment,
) {
  const toolbar = page.getByTestId("creative-richtext-toolbar-row");
  const editable = page
    .getByTestId("creative-inline-richtext-editor")
    .locator('[contenteditable="true"]')
    .first();

  await editable.click({ force: true });
  await page.keyboard.press(`${MODIFIER_KEY}+A`);

  if (mode === "bullet") {
    await toolbar.locator('button[title="Bullet List"]').first().click();
  } else if (mode === "numbered") {
    await toolbar.locator('button[title="Numbered List"]').first().click();
  }

  await editable.click({ force: true });
  await page.keyboard.press(`${MODIFIER_KEY}+A`);
  await toolbar.getByRole("button", { name: "Text alignment" }).click();
  const labelByAlignment: Record<Alignment, string> = {
    left: "Left",
    center: "Center",
    right: "Right",
    justify: "Justify",
  };
  await page.getByRole("menuitem", { name: labelByAlignment[alignment] }).click();
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Static snapshot captures block/list metrics used across all parity cases.
async function captureStaticSnapshot(page: Parameters<typeof test>[0]["page"]) {
  const staticRichText = page
    .locator(
      '[data-testid^="creative-richtext-static-"]:not([data-testid="creative-richtext-static-layer"])',
    )
    .first();
  await expect(staticRichText).toBeVisible({ timeout: 12000 });
  // biome-ignore lint/complexity/noExcessiveLinesPerFunction: Browser-side extractor normalizes text/list geometry in one pass for stable comparisons.
  return staticRichText.evaluate((node) => {
    const normalizeText = (value: string) =>
      value
        .replace(/\u200b/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const normalizeAlign = (value: string): Alignment => {
      const lowered = value.toLowerCase();
      if (lowered === "start") return "left";
      if (lowered === "end") return "right";
      if (lowered === "center" || lowered === "right" || lowered === "justify") return lowered;
      return "left";
    };
    const parsePx = (value: string) => {
      const numeric = Number.parseFloat(value);
      return Number.isFinite(numeric) ? numeric : null;
    };
    const toOffset = (target: HTMLElement, frame: HTMLElement) => {
      const frameRect = frame.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      return {
        x: targetRect.left - frameRect.left,
        y: targetRect.top - frameRect.top,
      };
    };
    const firstGlyphOffset = (target: HTMLElement, frame: HTMLElement) => {
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const textNode = walker.currentNode;
        const textContent = textNode.textContent ?? "";
        if (!textContent.trim()) continue;
        const nonWhitespaceIndex = textContent.search(/\S/);
        if (nonWhitespaceIndex < 0) continue;
        const range = document.createRange();
        const nextIndex = Math.min(nonWhitespaceIndex + 1, textContent.length);
        range.setStart(textNode, nonWhitespaceIndex);
        range.setEnd(textNode, nextIndex);
        const rect = range.getBoundingClientRect();
        if (rect.width <= 0 && rect.height <= 0) continue;
        const frameRect = frame.getBoundingClientRect();
        return {
          x: rect.left - frameRect.left,
          y: rect.top - frameRect.top,
        };
      }
      return { x: null, y: null };
    };

    const frame = node.querySelector(".remora-richtext-frame") as HTMLElement | null;
    const content = node.querySelector(".remora-richtext-content") as HTMLElement | null;
    if (!frame || !content) return null;

    const blocks = Array.from(content.querySelectorAll(":scope > p, :scope > ul, :scope > ol")).map(
      (element) => {
        const host = element as HTMLElement;
        const styles = getComputedStyle(host);
        const tagName = host.tagName.toLowerCase();

        if (tagName === "p") {
          const offset = toOffset(host, frame);
          const glyph = firstGlyphOffset(host, frame);
          return {
            kind: "paragraph" as const,
            text: normalizeText(host.textContent ?? ""),
            align: normalizeAlign(styles.textAlign),
            lineHeight: parsePx(styles.lineHeight),
            marginBottom: parsePx(styles.marginBottom),
            x: offset.x,
            y: offset.y,
            firstGlyphX: glyph.x,
            firstGlyphY: glyph.y,
          };
        }

        const offset = toOffset(host, frame);
        return {
          kind: "list" as const,
          listType: tagName === "ol" ? ("numbered" as const) : ("bullet" as const),
          align: normalizeAlign(styles.textAlign),
          lineHeight: parsePx(styles.lineHeight),
          marginBottom: parsePx(styles.marginBottom),
          paddingLeft: parsePx(styles.paddingLeft),
          listStyleType: styles.listStyleType,
          x: offset.x,
          y: offset.y,
          items: Array.from(host.querySelectorAll(":scope > li")).map((item) => {
            const itemHost = item as HTMLElement;
            const itemStyles = getComputedStyle(itemHost);
            const itemOffset = toOffset(itemHost, frame);
            const glyph = firstGlyphOffset(itemHost, frame);
            return {
              text: normalizeText(itemHost.textContent ?? ""),
              align: normalizeAlign(itemStyles.textAlign),
              lineHeight: parsePx(itemStyles.lineHeight),
              marginBottom: parsePx(itemStyles.marginBottom),
              x: itemOffset.x,
              y: itemOffset.y,
              firstGlyphX: glyph.x,
              firstGlyphY: glyph.y,
            };
          }),
        };
      },
    );

    const trimmed = [...blocks];
    while (
      trimmed.length > 1 &&
      trimmed[trimmed.length - 1]?.kind === "paragraph" &&
      trimmed[trimmed.length - 1]?.text === ""
    ) {
      trimmed.pop();
    }

    return {
      overflow: frame.scrollHeight > frame.clientHeight + 1,
      blocks: trimmed,
    };
  }) as Promise<SurfaceSnapshot | null>;
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Inline snapshot mirrors static extractor to avoid cross-surface drift in assertions.
async function captureInlineSnapshot(page: Parameters<typeof test>[0]["page"]) {
  const inlineRoot = page.getByTestId("creative-inline-richtext-editor");
  await expect(inlineRoot).toBeVisible({ timeout: 12000 });
  // biome-ignore lint/complexity/noExcessiveLinesPerFunction: Browser-side extractor keeps inline metrics equivalent to static capture logic.
  return inlineRoot.evaluate((node) => {
    const normalizeText = (value: string) =>
      value
        .replace(/\u200b/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const normalizeAlign = (value: string): Alignment => {
      const lowered = value.toLowerCase();
      if (lowered === "start") return "left";
      if (lowered === "end") return "right";
      if (lowered === "center" || lowered === "right" || lowered === "justify") return lowered;
      return "left";
    };
    const parsePx = (value: string) => {
      const numeric = Number.parseFloat(value);
      return Number.isFinite(numeric) ? numeric : null;
    };
    const toOffset = (target: HTMLElement, frame: HTMLElement) => {
      const frameRect = frame.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      return {
        x: targetRect.left - frameRect.left,
        y: targetRect.top - frameRect.top,
      };
    };
    const firstGlyphOffset = (target: HTMLElement, frame: HTMLElement) => {
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const textNode = walker.currentNode;
        const textContent = textNode.textContent ?? "";
        if (!textContent.trim()) continue;
        const nonWhitespaceIndex = textContent.search(/\S/);
        if (nonWhitespaceIndex < 0) continue;
        const range = document.createRange();
        const nextIndex = Math.min(nonWhitespaceIndex + 1, textContent.length);
        range.setStart(textNode, nonWhitespaceIndex);
        range.setEnd(textNode, nextIndex);
        const rect = range.getBoundingClientRect();
        if (rect.width <= 0 && rect.height <= 0) continue;
        const frameRect = frame.getBoundingClientRect();
        return {
          x: rect.left - frameRect.left,
          y: rect.top - frameRect.top,
        };
      }
      return { x: null, y: null };
    };

    const scrollHost = node.querySelector(
      ".remora-lexical-inline-scroll-host",
    ) as HTMLElement | null;
    const content = node.querySelector('[contenteditable="true"]') as HTMLElement | null;
    if (!scrollHost || !content) return null;

    const blocks = Array.from(content.querySelectorAll(":scope > p, :scope > ul, :scope > ol")).map(
      (element) => {
        const host = element as HTMLElement;
        const styles = getComputedStyle(host);
        const tagName = host.tagName.toLowerCase();

        if (tagName === "p") {
          const offset = toOffset(host, scrollHost);
          const glyph = firstGlyphOffset(host, scrollHost);
          return {
            kind: "paragraph" as const,
            text: normalizeText(host.textContent ?? ""),
            align: normalizeAlign(styles.textAlign),
            lineHeight: parsePx(styles.lineHeight),
            marginBottom: parsePx(styles.marginBottom),
            x: offset.x,
            y: offset.y,
            firstGlyphX: glyph.x,
            firstGlyphY: glyph.y,
          };
        }

        const offset = toOffset(host, scrollHost);
        return {
          kind: "list" as const,
          listType: tagName === "ol" ? ("numbered" as const) : ("bullet" as const),
          align: normalizeAlign(styles.textAlign),
          lineHeight: parsePx(styles.lineHeight),
          marginBottom: parsePx(styles.marginBottom),
          paddingLeft: parsePx(styles.paddingLeft),
          listStyleType: styles.listStyleType,
          x: offset.x,
          y: offset.y,
          items: Array.from(host.querySelectorAll(":scope > li")).map((item) => {
            const itemHost = item as HTMLElement;
            const itemStyles = getComputedStyle(itemHost);
            const itemOffset = toOffset(itemHost, scrollHost);
            const glyph = firstGlyphOffset(itemHost, scrollHost);
            return {
              text: normalizeText(itemHost.textContent ?? ""),
              align: normalizeAlign(itemStyles.textAlign),
              lineHeight: parsePx(itemStyles.lineHeight),
              marginBottom: parsePx(itemStyles.marginBottom),
              x: itemOffset.x,
              y: itemOffset.y,
              firstGlyphX: glyph.x,
              firstGlyphY: glyph.y,
            };
          }),
        };
      },
    );

    const trimmed = [...blocks];
    while (
      trimmed.length > 1 &&
      trimmed[trimmed.length - 1]?.kind === "paragraph" &&
      trimmed[trimmed.length - 1]?.text === ""
    ) {
      trimmed.pop();
    }

    const overflowHost = scrollHost.scrollHeight > scrollHost.clientHeight + 1;
    const overflowContent = content.scrollHeight > content.clientHeight + 1;
    return {
      overflow: overflowHost || overflowContent,
      blocks: trimmed,
    };
  }) as Promise<SurfaceSnapshot | null>;
}

function expectClose(actual: number | null, expected: number | null, tolerance = 0.75) {
  expect(actual).not.toBeNull();
  expect(expected).not.toBeNull();
  if (actual == null || expected == null) return;
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Parity comparison walks nested list/paragraph metrics and glyph offsets.
function assertSnapshotParity(staticSnapshot: SurfaceSnapshot, inlineSnapshot: SurfaceSnapshot) {
  expect(inlineSnapshot.blocks).toHaveLength(staticSnapshot.blocks.length);
  for (let index = 0; index < staticSnapshot.blocks.length; index += 1) {
    const staticBlock = staticSnapshot.blocks[index];
    const inlineBlock = inlineSnapshot.blocks[index];
    expect(inlineBlock?.kind).toBe(staticBlock?.kind);
    if (!staticBlock || !inlineBlock) continue;

    expect(inlineBlock.align).toBe(staticBlock.align);
    expectClose(inlineBlock.lineHeight, staticBlock.lineHeight);
    expectClose(inlineBlock.marginBottom, staticBlock.marginBottom);
    expectClose(inlineBlock.x, staticBlock.x, 2);
    expectClose(inlineBlock.y, staticBlock.y, 2);

    if (staticBlock.kind === "paragraph" && inlineBlock.kind === "paragraph") {
      expect(inlineBlock.text).toBe(staticBlock.text);
      expectClose(inlineBlock.firstGlyphX, staticBlock.firstGlyphX, 2);
      expectClose(inlineBlock.firstGlyphY, staticBlock.firstGlyphY, 2);
      continue;
    }

    if (staticBlock.kind === "list" && inlineBlock.kind === "list") {
      expect(inlineBlock.listType).toBe(staticBlock.listType);
      expect(inlineBlock.listStyleType).toBe(staticBlock.listStyleType);
      expectClose(inlineBlock.paddingLeft, staticBlock.paddingLeft);
      expect(inlineBlock.items).toHaveLength(staticBlock.items.length);
      for (let itemIndex = 0; itemIndex < staticBlock.items.length; itemIndex += 1) {
        const staticItem = staticBlock.items[itemIndex];
        const inlineItem = inlineBlock.items[itemIndex];
        expect(inlineItem?.text).toBe(staticItem?.text);
        expect(inlineItem?.align).toBe(staticItem?.align);
        expectClose(inlineItem?.lineHeight ?? null, staticItem?.lineHeight ?? null);
        expectClose(inlineItem?.marginBottom ?? null, staticItem?.marginBottom ?? null);
        expectClose(inlineItem?.x ?? null, staticItem?.x ?? null, 2);
        expectClose(inlineItem?.y ?? null, staticItem?.y ?? null, 2);
        expectClose(inlineItem?.firstGlyphX ?? null, staticItem?.firstGlyphX ?? null, 2);
        expectClose(inlineItem?.firstGlyphY ?? null, staticItem?.firstGlyphY ?? null, 2);
      }
    }
  }
}

test.describe("Creative inline double-click preview parity", () => {
  for (const parityCase of CASES) {
    test(`double-click inline view matches static preview for ${parityCase.name}`, async ({
      page,
    }) => {
      const consoleErrors: string[] = [];
      const onConsole = (message: { type: () => string; text: () => string }) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      };
      page.on("console", onConsole);
      try {
        await createDeckAndOpenEditor(page);
        await openInlineByToolbar(page);
        await writeLinesToInlineEditor(page, parityCase.lines);
        await applyModeAndAlignment(page, parityCase.mode, parityCase.alignment);

        await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({
          timeout: 20000,
        });
        await page.getByRole("button", { name: "Done" }).click();

        const staticSnapshot = await captureStaticSnapshot(page);
        expect(staticSnapshot).not.toBeNull();
        if (!staticSnapshot) return;
        if (parityCase.expectOverflow) {
          expect(staticSnapshot.overflow).toBeTruthy();
        }

        await openInlineByDoubleClick(page);
        const inlineSnapshot = await captureInlineSnapshot(page);
        expect(inlineSnapshot).not.toBeNull();
        if (!inlineSnapshot) return;
        if (parityCase.expectOverflow) {
          expect(inlineSnapshot.overflow).toBeTruthy();
        }
        expect(inlineSnapshot.overflow).toBe(staticSnapshot.overflow);
        assertSnapshotParity(staticSnapshot, inlineSnapshot);
        expect(consoleErrors.some((message) => /invalid indent value/i.test(message))).toBeFalsy();
      } finally {
        page.off("console", onConsole);
      }
    });
  }
});

test("creative inline toolbar list + alignment flow does not emit invalid indent errors", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const onConsole = (message: { type: () => string; text: () => string }) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  };
  page.on("console", onConsole);
  try {
    await createDeckAndOpenEditor(page);
    await openInlineByToolbar(page);

    const inlineEditable = page
      .getByTestId("creative-inline-richtext-editor")
      .locator('[contenteditable="true"]')
      .first();
    const expectInlineSelectionToStayActive = async () => {
      await expect(inlineEditable).toBeVisible({ timeout: 12000 });
      await expect
        .poll(
          async () =>
            inlineEditable.evaluate((node) => {
              const selection = window.getSelection();
              if (!selection || selection.rangeCount === 0) return false;
              const anchorNode = selection.anchorNode;
              const focusNode = selection.focusNode;
              return Boolean(
                anchorNode && focusNode && node.contains(anchorNode) && node.contains(focusNode),
              );
            }),
          { timeout: 4000 },
        )
        .toBeTruthy();
    };

    await inlineEditable.click({ force: true });
    await page.keyboard.insertText("creative bullet item one");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("creative bullet item two");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("creative bullet item three");

    const toolbar = page.getByTestId("creative-richtext-toolbar-row");
    await inlineEditable.click({ force: true });
    await page.keyboard.press(`${MODIFIER_KEY}+A`);
    await toolbar.locator('button[title="Bullet List"]').first().click();
    await expectInlineSelectionToStayActive();
    await inlineEditable.click({ force: true });
    await page.keyboard.press(`${MODIFIER_KEY}+A`);
    await toolbar.getByRole("button", { name: "Text alignment" }).click();
    await page.getByRole("menuitem", { name: "Right" }).click();
    await expectInlineSelectionToStayActive();
    await inlineEditable.click({ force: true });
    await page.keyboard.press(`${MODIFIER_KEY}+A`);
    await toolbar.locator('button[title="Numbered List"]').first().click();
    await expectInlineSelectionToStayActive();
    await inlineEditable.click({ force: true });
    await page.keyboard.press(`${MODIFIER_KEY}+A`);
    await toolbar.getByRole("button", { name: "Text alignment" }).click();
    await page.getByRole("menuitem", { name: "Center" }).click();
    await expectInlineSelectionToStayActive();

    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({
      timeout: 20000,
    });
    expect(consoleErrors.some((message) => /invalid indent value/i.test(message))).toBeFalsy();
  } finally {
    page.off("console", onConsole);
  }
});

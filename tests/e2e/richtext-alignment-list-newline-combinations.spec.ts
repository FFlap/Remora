import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

type EditorMode = "paragraph" | "bullet" | "numbered";
type Alignment = "left" | "center" | "right" | "justify";

type RichTextCase = {
  name: string;
  mode: EditorMode;
  alignment: Alignment;
  lines: string[];
};

type ParsedBlock =
  | {
      kind: "paragraph";
      align: Alignment;
      text: string;
    }
  | {
      kind: "list";
      listType: "bullet" | "numbered";
      align: Alignment;
      itemAlignments: Alignment[];
      items: string[];
    };

const MODIFIER_KEY = process.platform === "darwin" ? "Meta" : "Control";

const CASES: RichTextCase[] = [
  {
    name: "paragraph-left-single-newline",
    mode: "paragraph",
    alignment: "left",
    lines: ["alpha left line", "beta left line"],
  },
  {
    name: "paragraph-center-blank-between",
    mode: "paragraph",
    alignment: "center",
    lines: ["alpha center line", "", "beta center line"],
  },
  {
    name: "paragraph-right-double-blank-between",
    mode: "paragraph",
    alignment: "right",
    lines: ["alpha right line", "", "", "beta right line"],
  },
  {
    name: "paragraph-justify-multi-line",
    mode: "paragraph",
    alignment: "justify",
    lines: ["first justify line", "second justify line", "third justify line"],
  },
  {
    name: "bullet-left-three-items",
    mode: "bullet",
    alignment: "left",
    lines: ["left bullet one", "left bullet two", "left bullet three"],
  },
  {
    name: "bullet-center-three-items",
    mode: "bullet",
    alignment: "center",
    lines: ["center bullet one", "center bullet two", "center bullet three"],
  },
  {
    name: "bullet-right-three-items",
    mode: "bullet",
    alignment: "right",
    lines: ["right bullet one", "right bullet two", "right bullet three"],
  },
  {
    name: "bullet-justify-three-items",
    mode: "bullet",
    alignment: "justify",
    lines: ["justify bullet one", "justify bullet two", "justify bullet three"],
  },
  {
    name: "numbered-left-three-items",
    mode: "numbered",
    alignment: "left",
    lines: ["left numbered one", "left numbered two", "left numbered three"],
  },
  {
    name: "numbered-center-three-items",
    mode: "numbered",
    alignment: "center",
    lines: ["center numbered one", "center numbered two", "center numbered three"],
  },
  {
    name: "numbered-right-three-items",
    mode: "numbered",
    alignment: "right",
    lines: ["right numbered one", "right numbered two", "right numbered three"],
  },
  {
    name: "numbered-justify-three-items",
    mode: "numbered",
    alignment: "justify",
    lines: ["justify numbered one", "justify numbered two", "justify numbered three"],
  },
];

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Rich Text Combo ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Alignment/list/newline combinations");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

async function typeLines(
  page: Parameters<typeof test>[0]["page"],
  editor: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
  lines: string[],
) {
  await editor.click({ force: true });
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

async function applyMode(mode: EditorMode, page: Parameters<typeof test>[0]["page"]) {
  await page.keyboard.press(`${MODIFIER_KEY}+A`);
  if (mode === "bullet") {
    await page.locator('button[title="Bullet List"]').first().click();
  }
  if (mode === "numbered") {
    await page.locator('button[title="Numbered List"]').first().click();
  }
}

async function applyAlignment(
  alignment: Alignment,
  page: Parameters<typeof test>[0]["page"],
  editor: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
) {
  await editor.click({ force: true });
  await page.keyboard.press(`${MODIFIER_KEY}+A`);
  await page.getByRole("button", { name: "Text alignment" }).first().click();
  const labelByAlignment: Record<Alignment, "Left" | "Center" | "Right" | "Justify"> = {
    left: "Left",
    center: "Center",
    right: "Right",
    justify: "Justify",
  };
  const label = labelByAlignment[alignment];
  await page.getByRole("menuitem", { name: label }).click();
}

function captureBlocks(locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>) {
  return locator.evaluate((node) => {
    const normalizeText = (value: string) =>
      value
        .replace(/\u200b/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const normalizeAlign = (value: string) => {
      const lowered = value.toLowerCase();
      if (lowered === "start") return "left";
      if (lowered === "end") return "right";
      return lowered;
    };

    const blocks = Array.from(node.querySelectorAll(":scope > p, :scope > ul, :scope > ol")).map(
      (element) => {
        const host = element as HTMLElement;
        const align = normalizeAlign(getComputedStyle(host).textAlign);
        if (host.tagName.toLowerCase() === "p") {
          return {
            kind: "paragraph",
            align,
            text: normalizeText(host.textContent ?? ""),
          };
        }

        return {
          kind: "list",
          listType: host.tagName.toLowerCase() === "ol" ? "numbered" : "bullet",
          align,
          itemAlignments: Array.from(host.querySelectorAll(":scope > li")).map((item) =>
            normalizeAlign(getComputedStyle(item as HTMLElement).textAlign),
          ),
          items: Array.from(host.querySelectorAll(":scope > li")).map((item) =>
            normalizeText((item as HTMLElement).textContent ?? ""),
          ),
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
    return trimmed;
  }) as Promise<ParsedBlock[]>;
}

async function assertCaseParity(
  mode: EditorMode,
  alignment: Alignment,
  lines: string[],
  page: Parameters<typeof test>[0]["page"],
  quickEditor: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
) {
  const editorBlocks = await captureBlocks(quickEditor);

  const quickPreviewBlocks = await captureBlocks(
    page
      .locator('[data-testid^="quick-live-preview-card-richtext-"] .remora-richtext-content')
      .first(),
  );

  const sidebarBlocks = await captureBlocks(
    page.locator('[data-testid^="card-sidebar-preview-"] .remora-richtext-content').first(),
  );

  await page.getByTestId("mode-creative-button").click();
  const creativeBlocks = await captureBlocks(
    page
      .locator(
        '[data-testid^="creative-richtext-static-"]:not([data-testid="creative-richtext-static-layer"]) .remora-richtext-content',
      )
      .first(),
  );

  expect(quickPreviewBlocks).toEqual(editorBlocks);
  expect(sidebarBlocks).toEqual(editorBlocks);
  expect(creativeBlocks).toEqual(editorBlocks);

  for (const block of editorBlocks) {
    if (block.kind === "paragraph") {
      expect(block.align).toBe(alignment);
      continue;
    }

    for (const itemAlignment of block.itemAlignments) {
      expect(itemAlignment).toBe(alignment);
    }
  }

  if (mode === "paragraph") {
    const paragraphBlocks = editorBlocks.filter((block) => block.kind === "paragraph");
    expect(paragraphBlocks).toHaveLength(lines.length);
    expect(paragraphBlocks.map((block) => block.text)).toEqual(lines.map((line) => line.trim()));
    return;
  }

  expect(editorBlocks).toHaveLength(1);
  const [listBlock] = editorBlocks;
  expect(listBlock).toBeTruthy();
  if (!listBlock || listBlock.kind !== "list") return;

  expect(listBlock.listType).toBe(mode);
  expect(listBlock.items).toEqual(lines.map((line) => line.trim()));
}

test.describe("Rich Text Combination Parity", () => {
  for (const richTextCase of CASES) {
    test(`matches editor and card preview for ${richTextCase.name}`, async ({ page }) => {
      await createDeckAndOpenEditor(page);
      const quickEditor = page
        .locator('.quick-editor-input-panel [contenteditable="true"]')
        .first();
      await expect(quickEditor).toBeVisible({ timeout: 12000 });

      await typeLines(page, quickEditor, richTextCase.lines);
      if (richTextCase.mode !== "paragraph") {
        await quickEditor.click({ force: true });
        await applyMode(richTextCase.mode, page);
      }
      await applyAlignment(richTextCase.alignment, page, quickEditor);

      await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({
        timeout: 20000,
      });

      await assertCaseParity(
        richTextCase.mode,
        richTextCase.alignment,
        richTextCase.lines,
        page,
        quickEditor,
      );
    });
  }

  test("quick editor list + alignment flow does not emit invalid indent errors", async ({
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
      const quickEditor = page
        .locator('.quick-editor-input-panel [contenteditable="true"]')
        .first();
      await expect(quickEditor).toBeVisible({ timeout: 12000 });

      await typeLines(page, quickEditor, [
        "quick bullet item one",
        "quick bullet item two",
        "quick bullet item three",
      ]);

      await quickEditor.click({ force: true });
      await page.keyboard.press(`${MODIFIER_KEY}+A`);
      await page.locator('button[title="Bullet List"]').first().click();
      await applyAlignment("right", page, quickEditor);
      await page.locator('button[title="Numbered List"]').first().click();
      await applyAlignment("center", page, quickEditor);

      await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({
        timeout: 20000,
      });
      expect(consoleErrors.some((message) => /invalid indent value/i.test(message))).toBeFalsy();
    } finally {
      page.off("console", onConsole);
    }
  });
});

import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";
import { CONSISTENCY_LONG_TEXT } from "./utils/longTextFixture";

type TextLayoutSignature = {
  text: string;
  rects: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
};

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Preview Character Parity ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Strict parity checks for sidebar, quick, and creative previews");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

function readTextLayoutSignature(
  locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
): Promise<TextLayoutSignature> {
  return locator.evaluate((node) => {
    const host = node as HTMLElement;
    const hostRect = host.getBoundingClientRect();
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    const rects: Array<{ x: number; y: number; width: number; height: number }> = [];

    let current = walker.nextNode();
    while (current) {
      const textNode = current as Text;
      const value = textNode.textContent ?? "";
      if (value.length > 0 && value.trim().length > 0) {
        range.selectNodeContents(textNode);
        const clientRects = Array.from(range.getClientRects());
        for (const rect of clientRects) {
          if (rect.width <= 0 || rect.height <= 0) continue;
          rects.push({
            x: (rect.left - hostRect.left) / hostRect.width,
            y: (rect.top - hostRect.top) / hostRect.height,
            width: rect.width / hostRect.width,
            height: rect.height / hostRect.height,
          });
        }
      }
      current = walker.nextNode();
    }

    return {
      text: host.innerText.replace(/\s+/g, " ").trim(),
      rects,
    };
  });
}

type LineRow = {
  y: number;
  minX: number;
  maxX: number;
  height: number;
};

function toLineRows(rects: TextLayoutSignature["rects"], yMergeTolerance = 0.003): LineRow[] {
  const sorted = [...rects].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
  const rows: LineRow[] = [];

  for (const rect of sorted) {
    const existing = rows.find((row) => Math.abs(row.y - rect.y) <= yMergeTolerance);
    if (!existing) {
      rows.push({
        y: rect.y,
        minX: rect.x,
        maxX: rect.x + rect.width,
        height: rect.height,
      });
      continue;
    }
    existing.minX = Math.min(existing.minX, rect.x);
    existing.maxX = Math.max(existing.maxX, rect.x + rect.width);
    existing.height = Math.max(existing.height, rect.height);
  }

  return rows.sort((a, b) => a.y - b.y);
}

function expectLineRowsEqual(
  a: TextLayoutSignature["rects"],
  b: TextLayoutSignature["rects"],
  tolerance = 0.003,
) {
  const rowsA = toLineRows(a, tolerance);
  const rowsB = toLineRows(b, tolerance);
  expect(rowsB.length).toBe(rowsA.length);
  for (let i = 0; i < rowsA.length; i += 1) {
    expect(Math.abs((rowsB[i]?.y ?? 0) - (rowsA[i]?.y ?? 0))).toBeLessThanOrEqual(tolerance);
    expect(Math.abs((rowsB[i]?.minX ?? 0) - (rowsA[i]?.minX ?? 0))).toBeLessThanOrEqual(tolerance);
    expect(Math.abs((rowsB[i]?.maxX ?? 0) - (rowsA[i]?.maxX ?? 0))).toBeLessThanOrEqual(tolerance);
    expect(Math.abs((rowsB[i]?.height ?? 0) - (rowsA[i]?.height ?? 0))).toBeLessThanOrEqual(
      tolerance,
    );
  }
}

test.describe("Preview character-position parity", () => {
  test("keeps long-text character line positions identical across sidebar, quick, and creative previews", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);

    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.fill(CONSISTENCY_LONG_TEXT);
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 20000 });

    const quickRichText = page
      .locator('[data-testid^="quick-live-preview-card-richtext-"]')
      .first();
    await expect(quickRichText).toBeVisible();
    const sidebarRoot = page.locator('[data-testid^="card-sidebar-preview-"] > div').first();
    await expect(sidebarRoot).toBeVisible();
    const sidebarContent = sidebarRoot.locator(":scope > div").first();
    await expect(sidebarContent).toBeVisible();
    const sidebarRichText = sidebarContent.locator(":scope > div.absolute > div").first();
    await expect(sidebarRichText).toBeVisible();

    const quickSignature = await readTextLayoutSignature(quickRichText);
    const sidebarSignature = await readTextLayoutSignature(sidebarRichText);

    expect(sidebarSignature.text).toBe(quickSignature.text);
    expectLineRowsEqual(quickSignature.rects, sidebarSignature.rects, 0.002);

    await page.getByTestId("mode-creative-button").click();
    const creativeRichText = page
      .locator(
        '[data-testid^="creative-richtext-static-"]:not([data-testid="creative-richtext-static-layer"])',
      )
      .first();
    await expect(creativeRichText).toBeVisible();

    const creativeSignature = await readTextLayoutSignature(creativeRichText);
    expect(creativeSignature.text).toBe(quickSignature.text);
    expectLineRowsEqual(quickSignature.rects, creativeSignature.rects, 0.002);
  });
});

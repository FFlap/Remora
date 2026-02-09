import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Sidebar Spacing Parity ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Sidebar preview paragraph spacing parity");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

type ParagraphMetric = {
  text: string;
  y: number;
  lineHeight: number;
};

async function getParagraphMetrics(
  locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
): Promise<ParagraphMetric[]> {
  return locator.evaluate((node) => {
    const richTextHost = node as HTMLElement;
    const hostRect = richTextHost.getBoundingClientRect();
    if (hostRect.height === 0 || hostRect.width === 0) return [] as ParagraphMetric[];

    const walker = document.createTreeWalker(richTextHost, NodeFilter.SHOW_TEXT);
    const lines: ParagraphMetric[] = [];
    const range = document.createRange();
    let current = walker.nextNode();
    while (current) {
      const textNode = current as Text;
      const value = textNode.textContent ?? "";
      if (value.trim().length > 0) {
        range.selectNodeContents(textNode);
        const rects = Array.from(range.getClientRects());
        for (const rect of rects) {
          if (rect.width <= 0 || rect.height <= 0) continue;
          lines.push({
            text: value.trim(),
            y: (rect.top - hostRect.top) / hostRect.height,
            lineHeight: rect.height / hostRect.height,
          });
        }
      }
      current = walker.nextNode();
    }
    return lines;
  });
}

test.describe("Sidebar preview spacing parity", () => {
  test("keeps paragraph spacing aligned between quick live preview and sidebar preview", async ({ page }) => {
    await createDeckAndOpenEditor(page);

    const quickEditor = page.locator('[contenteditable="true"]').first();
    await quickEditor.click();
    await quickEditor.fill("Para one\n\nPara two\n\nPara three");
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 20000 });

    const quickRichText = page.locator('[data-testid^="quick-live-preview-card-richtext-"]').first();
    await expect(quickRichText).toBeVisible();
    const sidebarRoot = page.locator('[data-testid^="card-sidebar-preview-"] > div').first();
    await expect(sidebarRoot).toBeVisible();
    const sidebarContent = sidebarRoot.locator(":scope > div").first();
    await expect(sidebarContent).toBeVisible();
    const sidebarRichText = sidebarContent.locator(":scope > div.absolute > div").first();
    await expect(sidebarRichText).toBeVisible();

    const quickLines = await getParagraphMetrics(quickRichText);
    const sidebarLines = await getParagraphMetrics(sidebarRichText);

    expect(quickLines.length).toBeGreaterThanOrEqual(3);
    expect(sidebarLines.length).toBeGreaterThanOrEqual(3);

    for (let i = 0; i < Math.min(quickLines.length, sidebarLines.length); i += 1) {
      expect(Math.abs((sidebarLines[i]?.y ?? 0) - (quickLines[i]?.y ?? 0))).toBeLessThanOrEqual(0.01);
      expect(Math.abs((sidebarLines[i]?.lineHeight ?? 0) - (quickLines[i]?.lineHeight ?? 0))).toBeLessThanOrEqual(0.01);
    }
  });
});

import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

type Viewport = { width: number; height: number };

const HALF_WIDTH_VIEWPORTS: Viewport[] = [
  { width: 1248, height: 896 },
  { width: 1140, height: 900 },
  { width: 1024, height: 900 },
  { width: 980, height: 860 },
];

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Half Width Deck ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Half-width quick preview fit regression");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

type QuickPreviewMetrics = {
  layoutMode: string | null;
  expectedRatio: number;
  renderedRatio: number;
  widthCoverage: number;
  cardFullyVisibleAtStart: boolean;
  topVisibleAtStart: boolean;
  bottomVisibleAtEnd: boolean;
  leftVisibleAtStart: boolean;
  rightVisibleAtEnd: boolean;
};

async function readQuickPreviewMetrics(
  page: Parameters<typeof test>[0]["page"],
): Promise<QuickPreviewMetrics | null> {
  return page.evaluate(() => {
    const stage = document.querySelector(".quick-editor-preview-stage") as HTMLElement | null;
    const card = document.querySelector('[data-testid="quick-live-preview-card"]') as HTMLElement | null;
    const contentRow = document.querySelector('[data-testid="editor-content-row"]') as HTMLElement | null;
    const surface = document.querySelector('[data-testid="quick-editor-surface-grid"]') as HTMLElement | null;
    if (!stage || !card || !contentRow || !surface) return null;

    const stageRect = stage.getBoundingClientRect();
    const expectedAspect = getComputedStyle(card).aspectRatio;

    const parseAspectRatio = (raw: string) => {
      if (!raw) return null;
      const trimmed = raw.trim();
      if (!trimmed || trimmed === "auto") return null;
      if (!trimmed.includes("/")) {
        const ratio = Number.parseFloat(trimmed);
        return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
      }
      const [left, right] = trimmed.split("/");
      const numerator = Number.parseFloat(left ?? "");
      const denominator = Number.parseFloat(right ?? "");
      if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
        return null;
      }
      return numerator / denominator;
    };

    const expectedRatio = parseAspectRatio(expectedAspect) ?? 1.5;
    contentRow.scrollTop = 0;
    contentRow.scrollLeft = 0;
    const stageRectAtStart = stage.getBoundingClientRect();
    const atStart = card.getBoundingClientRect();
    const renderedRatio = atStart.width / Math.max(1, atStart.height);
    const widthCoverage = atStart.width / Math.max(1, stageRectAtStart.width);

    const maxScrollY = Math.max(0, contentRow.scrollHeight - contentRow.clientHeight);
    const maxScrollX = Math.max(0, contentRow.scrollWidth - contentRow.clientWidth);
    contentRow.scrollTop = maxScrollY;
    const stageRectAtEnd = stage.getBoundingClientRect();
    const atBottom = card.getBoundingClientRect();
    contentRow.scrollLeft = maxScrollX;
    const stageRectAtHorizontalEnd = stage.getBoundingClientRect();
    const atEnd = card.getBoundingClientRect();

    const topVisibleAtStart = atStart.top >= stageRectAtStart.top - 1;
    const leftVisibleAtStart = atStart.left >= stageRectAtStart.left - 1;
    const bottomVisibleAtEnd = atBottom.bottom <= stageRectAtEnd.bottom + 1;
    const rightVisibleAtEnd = atEnd.right <= stageRectAtHorizontalEnd.right + 1;
    const cardFullyVisibleAtStart =
      topVisibleAtStart &&
      leftVisibleAtStart &&
      atStart.bottom <= stageRectAtStart.bottom + 1 &&
      atStart.right <= stageRectAtStart.right + 1;

    contentRow.scrollTop = 0;
    contentRow.scrollLeft = 0;

    return {
      layoutMode: surface.dataset.layout ?? null,
      expectedRatio,
      renderedRatio,
      widthCoverage,
      cardFullyVisibleAtStart,
      topVisibleAtStart,
      bottomVisibleAtEnd,
      leftVisibleAtStart,
      rightVisibleAtEnd,
    };
  });
}

test.describe("Quick half-width preview fit", () => {
  test("switches between split and stacked layouts based on container fit", async ({ page }) => {
    await createDeckAndOpenEditor(page);
    await page.getByTestId("mode-quick-button").click();

    await page.setViewportSize({ width: 2200, height: 1200 });
    await expect(page.getByTestId("quick-editor-surface-grid")).toHaveAttribute("data-layout", "split");

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId("quick-editor-surface-grid")).toHaveAttribute("data-layout", "stacked");

    await page.setViewportSize({ width: 920, height: 760 });
    await expect(page.getByTestId("quick-editor-surface-grid")).toHaveAttribute("data-layout", "stacked");

    await page.setViewportSize({ width: 1280, height: 560 });
    await expect(page.getByTestId("quick-editor-surface-grid")).toHaveAttribute("data-layout", "stacked");

    const inputPanel = page.locator(".quick-editor-input-panel").first();
    const previewPanel = page.locator(".quick-editor-preview-panel").first();
    const previewCard = page.getByTestId("quick-live-preview-card");
    const surface = page.getByTestId("quick-editor-surface-grid");
    const inputBox = await inputPanel.boundingBox();
    const previewBox = await previewPanel.boundingBox();
    const cardBox = await previewCard.boundingBox();
    const surfaceBox = await surface.boundingBox();
    expect(inputBox).not.toBeNull();
    expect(previewBox).not.toBeNull();
    expect(cardBox).not.toBeNull();
    expect(surfaceBox).not.toBeNull();
    if (!inputBox || !previewBox || !cardBox || !surfaceBox) return;

    expect(previewBox.y).toBeLessThanOrEqual(inputBox.y + 1);
    expect(previewBox.y + previewBox.height).toBeLessThanOrEqual(inputBox.y + 1);
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(inputBox.y + 1);
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(previewBox.y + previewBox.height + 1);
    expect(previewBox.width / Math.max(1, surfaceBox.width)).toBeGreaterThanOrEqual(0.96);
    expect(inputBox.width / Math.max(1, surfaceBox.width)).toBeGreaterThanOrEqual(0.96);
  });

  test("keeps full quick live preview visible and preserves card aspect ratio", async ({ page }) => {
    await createDeckAndOpenEditor(page);
    await page.getByTestId("mode-quick-button").click();
    await expect(page.getByTestId("quick-live-preview-card")).toBeVisible();

    for (const viewport of HALF_WIDTH_VIEWPORTS) {
      await page.setViewportSize(viewport);
      await expect(page.getByTestId("quick-live-preview-card")).toBeVisible();

      const metrics = await readQuickPreviewMetrics(page);
      expect(metrics).not.toBeNull();
      if (!metrics) continue;

      const verticallyInspectable = metrics.topVisibleAtStart && metrics.bottomVisibleAtEnd;
      expect(metrics.layoutMode === "split" || metrics.layoutMode === "stacked").toBeTruthy();
      expect(metrics.widthCoverage).toBeGreaterThanOrEqual(0.9);
      expect(metrics.cardFullyVisibleAtStart || verticallyInspectable).toBeTruthy();
      expect(Math.abs(metrics.renderedRatio - metrics.expectedRatio)).toBeLessThanOrEqual(0.08);
    }
  });
});

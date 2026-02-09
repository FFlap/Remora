import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";
import { comparePngBuffers } from "./utils/imageDiff";

type NormalizedTextBlock = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Preview Surface Parity ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Ensure sidebar, quick, creative previews stay aligned");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

async function drawReferenceStroke(page: Parameters<typeof test>[0]["page"]) {
  const canvas = page.getByTestId("creative-card-canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.getByTestId("creative-tool-draw").click();
  await page.mouse.move(box.x + 72, box.y + 112);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 86, box.y + 188, { steps: 16 });
  await page.mouse.up();

  await page.getByTestId("creative-tool-select").click();
  await page.mouse.click(box.x + box.width - 8, box.y + box.height - 8);
}

async function getNormalizedTextBlocks(
  locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
) {
  const blocks = await locator.evaluate((node) => {
    const root = node as HTMLElement;
    const rootRect = root.getBoundingClientRect();
    if (rootRect.width === 0 || rootRect.height === 0) return [] as NormalizedTextBlock[];

    const wrappers = Array.from(root.querySelectorAll(":scope > div.absolute"));
    return wrappers
      .map((element) => {
        const el = element as HTMLElement;
        const rect = el.getBoundingClientRect();
        const text = el.innerText.replace(/\s+/g, " ").trim();
        return {
          text,
          x: (rect.left - rootRect.left) / rootRect.width,
          y: (rect.top - rootRect.top) / rootRect.height,
          width: rect.width / rootRect.width,
          height: rect.height / rootRect.height,
        };
      })
      .filter((entry) => entry.text.length > 0);
  });

  return [...blocks].sort((a, b) => {
    if (a.text !== b.text) return a.text.localeCompare(b.text);
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
}

function expectBlockGeometryClose(
  a: NormalizedTextBlock[],
  b: NormalizedTextBlock[],
  tolerance = 0.03,
) {
  expect(b.length).toBe(a.length);
  for (let i = 0; i < a.length; i += 1) {
    expect(b[i]?.text).toBe(a[i]?.text);
    expect(Math.abs((b[i]?.x ?? 0) - (a[i]?.x ?? 0))).toBeLessThanOrEqual(tolerance);
    expect(Math.abs((b[i]?.y ?? 0) - (a[i]?.y ?? 0))).toBeLessThanOrEqual(tolerance);
    expect(Math.abs((b[i]?.width ?? 0) - (a[i]?.width ?? 0))).toBeLessThanOrEqual(tolerance);
    expect(Math.abs((b[i]?.height ?? 0) - (a[i]?.height ?? 0))).toBeLessThanOrEqual(tolerance);
  }
}

test.describe("Preview surface parity", () => {
  test("keeps sidebar preview, quick live preview, and creative preview visually aligned", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);

    await page.getByTestId("side-tray-item-1").click();

    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await page.keyboard.type("Surface parity token side two.");
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId("mode-creative-button").click();
    await drawReferenceStroke(page);
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

    const creativeCardContent = page.getByTestId("creative-card-shell").locator(":scope > div").first();
    await expect(creativeCardContent).toBeVisible();
    const creativeTextLayer = page.getByTestId("creative-richtext-static-layer");
    await expect(creativeTextLayer).toBeVisible();

    await page.getByTestId("mode-quick-button").click();
    const quickContent = page.getByTestId("quick-live-preview-card-content");
    await expect(quickContent).toBeVisible();
    await expect
      .poll(async () => quickContent.locator("svg path").count(), { timeout: 10000 })
      .toBeGreaterThanOrEqual(1);

    const sidebarRoot = page.locator('[data-testid^="card-sidebar-preview-"] > div').first();
    await expect(sidebarRoot).toBeVisible();
    const sidebarContent = sidebarRoot.locator(":scope > div").first();
    await expect(sidebarContent).toBeVisible();

    const quickTextBlocks = await getNormalizedTextBlocks(quickContent);
    const sidebarTextBlocks = await getNormalizedTextBlocks(sidebarContent);
    expect(quickTextBlocks.some((entry) => entry.text.includes("side two"))).toBeTruthy();
    expect(sidebarTextBlocks.some((entry) => entry.text.includes("side two"))).toBeTruthy();
    expectBlockGeometryClose(quickTextBlocks, sidebarTextBlocks, 0.012);

    await page.getByTestId("mode-creative-button").click();
    const creativeTextBlocks = await getNormalizedTextBlocks(creativeTextLayer);
    expectBlockGeometryClose(quickTextBlocks, creativeTextBlocks, 0.04);

    await page.getByTestId("mode-quick-button").click();
    const quickBuffer = await quickContent.screenshot({ type: "png" });
    const sidebarBuffer = await sidebarContent.screenshot({ type: "png" });

    await page.getByTestId("mode-creative-button").click();
    const creativeCardShell = page.getByTestId("creative-card-shell");
    await expect(creativeCardShell).toBeVisible({ timeout: 10000 });
    const creativeBuffer = await creativeCardShell.locator(":scope > div").first().screenshot({ type: "png" });

    const quickVsSidebar = comparePngBuffers(quickBuffer, sidebarBuffer, {
      width: 520,
      height: 340,
      inkAlphaMin: 25,
      inkLumaMax: 220,
    });
    const quickVsCreative = comparePngBuffers(quickBuffer, creativeBuffer, {
      width: 520,
      height: 340,
      inkAlphaMin: 25,
      inkLumaMax: 220,
    });
    const sidebarVsCreative = comparePngBuffers(sidebarBuffer, creativeBuffer, {
      width: 520,
      height: 340,
      inkAlphaMin: 25,
      inkLumaMax: 220,
    });

    expect(quickVsSidebar.diffRatio).toBeLessThan(0.06);
    expect(quickVsCreative.diffRatio).toBeLessThan(0.14);
    expect(sidebarVsCreative.diffRatio).toBeLessThan(0.14);

    if (quickVsCreative.aInkBounds && quickVsCreative.bInkBounds) {
      expect(Math.abs(quickVsCreative.aInkBounds.minX - quickVsCreative.bInkBounds.minX)).toBeLessThan(12);
      expect(Math.abs(quickVsCreative.aInkBounds.maxX - quickVsCreative.bInkBounds.maxX)).toBeLessThan(12);
      expect(Math.abs(quickVsCreative.aInkBounds.minY - quickVsCreative.bInkBounds.minY)).toBeLessThan(12);
      expect(Math.abs(quickVsCreative.aInkBounds.maxY - quickVsCreative.bInkBounds.maxY)).toBeLessThan(12);
    }
  });
});

import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";
import { comparePngBuffers } from "./utils/imageDiff";

async function openNewDeckEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );
  await page.getByPlaceholder("Biology Midterm").fill(`Visual Diff Deck ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Visual parity check");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

test.describe("Quick/Create visual parity", () => {
  test("keeps preview perspective visually consistent with creative canvas (pixel-diff tolerance)", async ({
    page,
  }) => {
    await openNewDeckEditor(page);

    await page.getByTestId("mode-creative-button").click();
    const creativeCanvas = page.getByTestId("creative-card-canvas");
    await expect(creativeCanvas).toBeVisible();

    const canvasBox = await creativeCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) return;

    // Keep the editor in select mode before switching to draw for deterministic pointer behavior.
    await page.getByTestId("creative-tool-select").click();

    await page.getByTestId("creative-tool-draw").click();
    await page.mouse.move(canvasBox.x + 40, canvasBox.y + 120);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width - 20, canvasBox.y + 12);
    await page.mouse.up();

    await page.mouse.move(canvasBox.x + 90, canvasBox.y + canvasBox.height - 80);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width - 160, canvasBox.y + 150);
    await page.mouse.up();

    await page.mouse.move(canvasBox.x + 170, canvasBox.y + 60);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 280, canvasBox.y + canvasBox.height - 40);
    await page.mouse.up();

    const creativeBuffer = await creativeCanvas.screenshot({ type: "png" });

    await page.getByTestId("mode-quick-button").click();
    const quickPreview = page.getByTestId("quick-live-preview-card");
    await expect(quickPreview).toBeVisible({ timeout: 10000 });
    const quickPreviewContent = quickPreview.locator('[data-testid="quick-live-preview-card-content"]');
    await expect(quickPreviewContent).toBeVisible({ timeout: 10000 });
    await expect
      .poll(async () => page.getByTestId("quick-live-preview-card").locator("svg path").count(), {
        timeout: 10000,
      })
      .toBeGreaterThanOrEqual(1);
    await quickPreviewContent.evaluate((node) => {
      const richTextBlocks = node.querySelectorAll('[data-testid*="-richtext-"]');
      for (const block of richTextBlocks) {
        (block as HTMLElement).style.visibility = "hidden";
      }
    });

    const quickBuffer = await quickPreviewContent.screenshot({ type: "png" });
    const comparison = comparePngBuffers(creativeBuffer, quickBuffer, {
      width: 480,
      height: 320,
      inkLumaMax: 180,
      inkAlphaMin: 30,
    });

    if (comparison.aInkBounds && comparison.bInkBounds) {
      expect(Math.abs(comparison.aInkBounds.minX - comparison.bInkBounds.minX)).toBeLessThan(10);
      expect(Math.abs(comparison.aInkBounds.maxX - comparison.bInkBounds.maxX)).toBeLessThan(10);
      expect(Math.abs(comparison.aInkBounds.minY - comparison.bInkBounds.minY)).toBeLessThan(10);
      expect(Math.abs(comparison.aInkBounds.maxY - comparison.bInkBounds.maxY)).toBeLessThan(10);
    }

    expect(comparison.diffRatio).toBeLessThan(0.13);

    await page.getByTestId("mode-creative-button").click();
    await expect(creativeCanvas).toBeVisible();
    await page.getByTestId("mode-quick-button").click();
    const quickBufferAfterRoundTrip = await quickPreviewContent.screenshot({ type: "png" });
    const roundTrip = comparePngBuffers(quickBuffer, quickBufferAfterRoundTrip, {
      width: 480,
      height: 320,
    });

    expect(roundTrip.diffRatio).toBeLessThan(0.01);
  });
});

import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";
import { comparePngBuffers } from "./utils/imageDiff";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`MouseUp Drift Deck ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Creative draw release stability");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

test.describe("Creative draw release stability", () => {
  test("does not shift stroke position after mouse-up", async ({ page }) => {
    await createDeckAndOpenEditor(page);

    await page.getByTestId("mode-creative-button").click();
    const creativeCanvas = page.getByTestId("creative-card-canvas");
    await expect(creativeCanvas).toBeVisible();

    const canvasBox = await creativeCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) return;

    await page.getByTestId("creative-tool-draw").click();

    await page.mouse.move(canvasBox.x + 52, canvasBox.y + 136);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 302, canvasBox.y + 132, { steps: 28 });
    await page.mouse.move(canvasBox.x + 552, canvasBox.y + 286, { steps: 28 });

    await page.mouse.up();
    const justAfterMouseUp = await creativeCanvas.screenshot({ type: "png" });
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(500);

    const afterStabilize = await creativeCanvas.screenshot({ type: "png" });
    const comparison = comparePngBuffers(justAfterMouseUp, afterStabilize, {
      width: 672,
      height: 448,
      threshold: 0.1,
      inkAlphaMin: 20,
      inkLumaMax: 180,
    });

    expect(comparison.aInkBounds).not.toBeNull();
    expect(comparison.bInkBounds).not.toBeNull();
    if (!comparison.aInkBounds || !comparison.bInkBounds) return;

    expect(Math.abs(comparison.aInkBounds.minX - comparison.bInkBounds.minX)).toBeLessThan(2);
    expect(Math.abs(comparison.aInkBounds.maxX - comparison.bInkBounds.maxX)).toBeLessThan(2);
    expect(Math.abs(comparison.aInkBounds.minY - comparison.bInkBounds.minY)).toBeLessThan(2);
    expect(Math.abs(comparison.aInkBounds.maxY - comparison.bInkBounds.maxY)).toBeLessThan(2);
    expect(comparison.diffRatio).toBeLessThan(0.005);
  });
});

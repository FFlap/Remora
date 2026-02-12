import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";
import { comparePngBuffers } from "./utils/imageDiff";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Exact Stroke Deck ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Stroke exact roundtrip");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

test.describe("Creative Stroke Exact Roundtrip", () => {
  test("keeps stroke position/shape exact before and after quick/creative switches and reload", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);

    await page.getByTestId("mode-creative-button").click();
    const creativeCanvas = page.getByTestId("creative-card-canvas");
    await expect(creativeCanvas).toBeVisible();

    const canvasBox = await creativeCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) return;

    await page.getByTestId("creative-tool-draw").click();

    await page.mouse.move(canvasBox.x + 44, canvasBox.y + 112);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 268, canvasBox.y + 70, { steps: 28 });
    await page.mouse.move(canvasBox.x + 540, canvasBox.y + 310, { steps: 28 });
    await page.mouse.up();

    await page.mouse.move(canvasBox.x + 96, canvasBox.y + 352);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 334, canvasBox.y + 174, { steps: 24 });
    await page.mouse.up();

    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

    const beforeSwitch = await creativeCanvas.screenshot({ type: "png" });

    await page.getByTestId("mode-quick-button").click();
    await expect(page.getByTestId("quick-live-preview-card")).toBeVisible();
    await page.getByTestId("mode-creative-button").click();
    await expect(creativeCanvas).toBeVisible();

    const afterSwitch = await creativeCanvas.screenshot({ type: "png" });
    const switchComparison = comparePngBuffers(beforeSwitch, afterSwitch, {
      width: 672,
      height: 448,
      threshold: 0.1,
      inkAlphaMin: 20,
      inkLumaMax: 180,
    });

    expect(switchComparison.diffRatio).toBeLessThan(0.01);

    await page.reload();
    await expect(page.getByTestId("mode-creative-button")).toBeVisible();
    await page.getByTestId("mode-creative-button").click();
    await expect(creativeCanvas).toBeVisible();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

    const afterReload = await creativeCanvas.screenshot({ type: "png" });
    const reloadComparison = comparePngBuffers(beforeSwitch, afterReload, {
      width: 672,
      height: 448,
      threshold: 0.1,
      inkAlphaMin: 20,
      inkLumaMax: 180,
    });

    expect(reloadComparison.diffRatio).toBeLessThan(0.015);
  });
});

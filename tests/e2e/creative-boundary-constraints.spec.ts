import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Bounds Deck ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Creative card bounds");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

test.describe("Creative Boundary Constraints", () => {
  test("keeps transformed text boxes inside card bounds", async ({ page }) => {
    await createDeckAndOpenEditor(page);

    const token = `Bounds${Date.now()}`;
    const quickEditor = page.locator('[contenteditable="true"]').first();
    await quickEditor.click();
    await page.keyboard.type(token);
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId("mode-creative-button").click();
    const creativeCanvas = page.getByTestId("creative-card-canvas");
    await expect(creativeCanvas).toBeVisible();

    const canvasBox = await creativeCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) return;

    await page.getByRole("button", { name: "Select" }).click();
    await page.mouse.click(canvasBox.x + 130, canvasBox.y + 120);

    // Try dragging the selected text box far beyond top-left.
    await page.mouse.move(canvasBox.x + 140, canvasBox.y + 130);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x - 320, canvasBox.y - 280, { steps: 16 });
    await page.mouse.up();

    // Try dragging far beyond bottom-right.
    await page.mouse.move(canvasBox.x + 180, canvasBox.y + 150);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width + 420, canvasBox.y + canvasBox.height + 380, { steps: 18 });
    await page.mouse.up();

    await page.getByTestId("mode-quick-button").click();

    // The text should still be visible in the quick live preview after aggressive out-of-bounds drags.
    await expect(page.getByTestId("quick-live-preview-card")).toContainText(token);

    const previewBounds = await page.getByTestId("quick-live-preview-card").boundingBox();
    const previewTextBounds = await page
      .getByTestId("quick-live-preview-card")
      .locator("*", { hasText: token })
      .first()
      .boundingBox();

    expect(previewBounds).not.toBeNull();
    expect(previewTextBounds).not.toBeNull();
    if (!previewBounds || !previewTextBounds) return;

    expect(previewTextBounds.x).toBeGreaterThanOrEqual(previewBounds.x - 1);
    expect(previewTextBounds.y).toBeGreaterThanOrEqual(previewBounds.y - 1);
    expect(previewTextBounds.x + previewTextBounds.width).toBeLessThanOrEqual(previewBounds.x + previewBounds.width + 1);
    expect(previewTextBounds.y + previewTextBounds.height).toBeLessThanOrEqual(previewBounds.y + previewBounds.height + 1);
  });
});

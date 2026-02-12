import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

test.describe("Insight-like editor parity", () => {
  test("keeps quick preview and creative canvas aligned with a fixed card viewport", async ({
    page,
  }) => {
    await signInAsOwner(page);

    await page.goto("/app/decks/new");
    await expect(page.getByTestId("newdeck-hydrated")).toHaveText("yes");
    const deckTitle = `UI Parity Deck ${Date.now()}`;
    await page.getByPlaceholder("Biology Midterm").fill(deckTitle);
    await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Playwright parity check");
    const createDeckButton = page.getByRole("button", { name: "Create Deck" });
    await expect(createDeckButton).toBeEnabled();
    await createDeckButton.click();

    await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
    await expect(page.locator('[data-testid^="card-sidebar-preview-"]').first()).toBeVisible();

    await page.getByTestId("mode-quick-button").click();
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("Parity sentence from quick mode.");

    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

    const quickPreview = page.getByTestId("quick-live-preview-card");
    await expect(quickPreview).toContainText("Parity sentence from quick mode.");

    const previewCentered = await quickPreview.evaluate((node) => {
      const parent = node.parentElement;
      if (!parent) return false;
      const nodeRect = node.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      const leftGap = nodeRect.left - parentRect.left;
      const rightGap = parentRect.right - nodeRect.right;
      return Math.abs(leftGap - rightGap) < 24;
    });
    expect(previewCentered).toBeTruthy();

    await page.getByTestId("mode-creative-button").click();

    const stage = page.getByTestId("creative-card-stage");
    const canvas = page.getByTestId("creative-card-canvas");
    await expect(stage).toBeVisible();
    await expect(canvas).toBeVisible();

    const stageBox = await stage.boundingBox();
    const canvasBox = await canvas.boundingBox();
    expect(stageBox).not.toBeNull();
    expect(canvasBox).not.toBeNull();
    if (stageBox && canvasBox) {
      expect(canvasBox.width / stageBox.width).toBeGreaterThan(0.58);
      expect(canvasBox.height / stageBox.height).toBeGreaterThan(0.58);
    }

    await page.getByTestId("creative-tool-draw").click();
    if (canvasBox) {
      await page.mouse.move(canvasBox.x + 140, canvasBox.y + 110);
      await page.mouse.down();
      await page.mouse.move(canvasBox.x + 320, canvasBox.y + 220);
      await page.mouse.up();
    }

    await page.getByTestId("mode-quick-button").click();
    await expect(quickPreview).toContainText("Parity sentence from quick mode.");
    await expect(quickPreview.locator("path").first()).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Rich Sync Deck ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Quick/Creative rich text sync");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

test.describe("Creative + Quick Rich Text Sync", () => {
  test("syncs rich text both ways, supports creative text boxes, and erases strokes", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);

    const quickEditor = page.locator('[contenteditable="true"]').first();
    await quickEditor.click();
    await page.keyboard.type("Quick to Creative Sync");
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("quick-live-preview-card")).toContainText(
      "Quick to Creative Sync",
    );

    await page.getByTestId("mode-creative-button").click();
    const creativeCanvas = page.getByTestId("creative-card-canvas");
    await expect(creativeCanvas).toBeVisible();

    const canvasBox = await creativeCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) return;

    await page.getByTestId("creative-tool-select").click();
    await page.mouse.dblclick(canvasBox.x + 130, canvasBox.y + 120);
    await page.waitForTimeout(250);
    await page.mouse.click(canvasBox.x + 150, canvasBox.y + 130);

    const creativeInlineEditor = page.getByTestId("creative-inline-richtext-editor");
    await expect(creativeInlineEditor).toBeVisible();

    const creativeEditor = creativeInlineEditor.locator('[contenteditable="true"]').first();
    await expect(creativeEditor).toContainText("Quick to Creative Sync");
    await creativeEditor.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("Quick to Creative Sync + Creative");
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId("creative-add-text-button").click();
    await page.getByRole("button", { name: "Edit Text" }).click();
    await expect(page.getByTestId("creative-inline-richtext-editor")).toBeVisible();

    await page.getByTestId("mode-quick-button").click();
    await expect(page.locator('[contenteditable="true"]').first()).toContainText(
      "Quick to Creative Sync + Creative",
    );
    await expect(page.getByTestId("quick-live-preview-card")).toContainText(
      "Quick to Creative Sync + Creative",
    );
    await expect(page.getByRole("button", { name: "Text 2" })).toBeVisible();

    await page.getByTestId("mode-creative-button").click();
    await expect(creativeCanvas).toBeVisible();

    await page.getByTestId("creative-tool-draw").click();
    await page.mouse.move(canvasBox.x + 80, canvasBox.y + 160);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width - 120, canvasBox.y + 220);
    await page.mouse.up();

    await page.getByTestId("mode-quick-button").click();
    await expect
      .poll(async () => page.getByTestId("quick-live-preview-card").locator("svg path").count(), {
        timeout: 10000,
      })
      .toBeGreaterThanOrEqual(1);

    await page.getByTestId("mode-creative-button").click();
    await page.getByTestId("creative-tool-erase").click();
    await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + 190);
    await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + 190);

    await page.getByTestId("mode-quick-button").click();
    await expect(page.getByTestId("quick-live-preview-card").locator("svg path")).toHaveCount(0, {
      timeout: 10000,
    });
  });
});

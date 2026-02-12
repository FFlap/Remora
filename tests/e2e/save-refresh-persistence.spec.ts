import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Save Refresh ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Save + refresh persistence");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

async function waitForSaved(page: Parameters<typeof test>[0]["page"]) {
  await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("Save failed", { exact: true })).toHaveCount(0);
}

async function openCreativeInlineEditor(page: Parameters<typeof test>[0]["page"]) {
  await page.getByTestId("mode-creative-button").click();
  await expect(page.getByTestId("creative-card-canvas")).toBeVisible({ timeout: 12000 });

  const staticRichText = page
    .locator(
      '[data-testid^="creative-richtext-static-"]:not([data-testid="creative-richtext-static-layer"])',
    )
    .first();
  await expect(staticRichText).toBeVisible({ timeout: 12000 });
  await staticRichText.click({ force: true });

  const editButton = page.getByRole("button", { name: "Edit Text" });
  if (await editButton.isVisible().catch(() => false)) {
    await editButton.click();
  }

  const inlineEditable = page
    .getByTestId("creative-inline-richtext-editor")
    .locator('[contenteditable="true"]')
    .first();
  await inlineEditable.click({ force: true });
  return inlineEditable;
}

test.describe("Save refresh persistence", () => {
  test("quick create text persists across refresh and further edits", async ({ page }) => {
    await createDeckAndOpenEditor(page);

    const tokenA = `quick-refresh-a-${Date.now()}`;
    const tokenB = `quick-refresh-b-${Date.now()}`;

    const editable = page.locator('.quick-editor-input-panel [contenteditable="true"]').first();
    await editable.click();
    await page.keyboard.type(tokenA);
    await waitForSaved(page);

    await page.reload();
    await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
    await expect(editable).toContainText(tokenA);
    await expect(page.getByTestId("quick-live-preview-card")).toContainText(tokenA);

    await editable.click();
    await page.keyboard.press("End");
    await page.keyboard.type(` ${tokenB}`);
    await waitForSaved(page);

    await page.reload();
    await expect(editable).toContainText(tokenB);
    await expect(editable).toContainText("quick-refresh-a");
    await expect(page.getByTestId("quick-live-preview-card")).toContainText("quick-refresh-a");
    await expect(page.getByTestId("quick-live-preview-card")).toContainText(tokenB);
  });

  test("creative inline text persists across refresh and further edits", async ({ page }) => {
    await createDeckAndOpenEditor(page);

    const tokenA = `creative-refresh-a-${Date.now()}`;
    const tokenB = `creative-refresh-b-${Date.now()}`;

    let inlineEditable = await openCreativeInlineEditor(page);
    await page.keyboard.type(tokenA);
    await waitForSaved(page);

    await page.reload();
    await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
    await page.getByTestId("mode-creative-button").click();
    const staticRichText = page
      .locator(
        '[data-testid^="creative-richtext-static-"]:not([data-testid="creative-richtext-static-layer"])',
      )
      .first();
    await expect(staticRichText).toContainText(tokenA);

    inlineEditable = await openCreativeInlineEditor(page);
    await page.keyboard.press("End");
    await page.keyboard.type(` ${tokenB}`);
    await waitForSaved(page);

    await page.reload();
    await page.getByTestId("mode-creative-button").click();
    await expect(staticRichText).toContainText("creative-refresh-a");
    await expect(staticRichText).toContainText(tokenB);
    inlineEditable = await openCreativeInlineEditor(page);
    await expect(inlineEditable).toContainText("creative-refresh-a");
    await expect(inlineEditable).toContainText(tokenB);
  });
});

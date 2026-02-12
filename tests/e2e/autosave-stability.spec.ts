import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Autosave Stability ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Autosave stability regression");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

async function assertNoSaveFailureLoop(page: Parameters<typeof test>[0]["page"], sampleMs = 2400) {
  const startedAt = Date.now();
  let failedSeen = false;

  while (Date.now() - startedAt < sampleMs) {
    const saveFailedVisible = await page
      .getByText("Save failed", { exact: true })
      .isVisible()
      .catch(() => false);
    if (saveFailedVisible) {
      failedSeen = true;
      break;
    }
    await page.waitForTimeout(120);
  }

  expect(failedSeen).toBeFalsy();
  await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });
}

test.describe("Autosave stability", () => {
  test("does not loop between Saving and Save failed while typing in quick create", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);

    const editable = page.locator('.quick-editor-input-panel [contenteditable="true"]').first();
    await editable.click();
    await page.keyboard.type("autosave quick stability token");

    await assertNoSaveFailureLoop(page);
  });

  test("does not loop between Saving and Save failed while typing in creative inline editor", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);
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
    await page.keyboard.type("autosave creative stability token");

    await assertNoSaveFailureLoop(page);
  });
});

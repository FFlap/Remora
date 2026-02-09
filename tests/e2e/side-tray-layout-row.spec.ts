import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Side Tray Row Deck ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Side tray row layout verification");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

async function expectTrayBelowEditorContent(page: Parameters<typeof test>[0]["page"]) {
  const contentRow = page.getByTestId("editor-content-row");
  const trayRow = page.getByTestId("editor-side-tray-row");
  const trayScroll = page.getByTestId("side-tray");

  await expect(contentRow).toBeVisible();
  await expect(trayRow).toBeVisible();
  await expect(trayScroll).toBeVisible();

  const contentBox = await contentRow.boundingBox();
  const trayBox = await trayRow.boundingBox();
  expect(contentBox).not.toBeNull();
  expect(trayBox).not.toBeNull();
  if (!contentBox || !trayBox) return;

  expect(contentBox.y + contentBox.height).toBeLessThanOrEqual(trayBox.y + 1);
  expect(trayBox.height).toBeGreaterThan(120);
}

test.describe("Bottom side tray row layout", () => {
  test("keeps side tray as a dedicated row in quick and creative modes", async ({ page }) => {
    await createDeckAndOpenEditor(page);

    await expectTrayBelowEditorContent(page);

    await page.getByTestId("mode-creative-button").click();
    await expect(page.getByTestId("creative-card-stage")).toBeVisible();
    await expectTrayBelowEditorContent(page);

    await page.getByTestId("mode-quick-button").click();
    await expect(page.getByTestId("quick-live-preview-card")).toBeVisible();
    await expectTrayBelowEditorContent(page);
  });

  test("supports horizontal overflow and selecting off-screen sides", async ({ page }) => {
    await createDeckAndOpenEditor(page);
    await page.setViewportSize({ width: 980, height: 860 });

    for (let index = 0; index < 24; index += 1) {
      await page.getByTestId("side-tray-add-side").click();
    }

    await expect
      .poll(async () => page.locator('[data-testid^="side-tray-item-"]').count(), { timeout: 15000 })
      .toBe(26);

    await page.getByTestId("side-tray").evaluate((node) => {
      node.scrollLeft = node.scrollWidth;
    });

    const lastSide = page.getByTestId("side-tray-item-25");
    await lastSide.scrollIntoViewIfNeeded();
    await lastSide.click();
    await expect(lastSide).toHaveAttribute("aria-pressed", "true");
  });

  test("keeps add, delete, select behavior and min-side delete guard", async ({ page }) => {
    await createDeckAndOpenEditor(page);

    const deleteButton = page.getByTestId("side-tray-delete-side");
    await expect(deleteButton).toBeEnabled();

    await page.getByTestId("side-tray-add-side").click();
    await expect
      .poll(async () => page.locator('[data-testid^="side-tray-item-"]').count(), { timeout: 10000 })
      .toBe(3);
    await expect(deleteButton).toBeEnabled();

    await page.getByTestId("side-tray-item-1").click();
    await expect(page.getByTestId("side-tray-item-1")).toHaveAttribute("aria-pressed", "true");

    await deleteButton.click();
    await deleteButton.click();
    await expect
      .poll(async () => page.locator('[data-testid^="side-tray-item-"]').count(), { timeout: 10000 })
      .toBe(1);
    await expect(page.getByTestId("side-tray-item-0")).toHaveAttribute("aria-pressed", "true");
    await expect(deleteButton).toBeDisabled();
  });
});

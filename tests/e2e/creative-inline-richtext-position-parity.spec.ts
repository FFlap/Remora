import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Inline Position Deck ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Creative inline rich text position parity");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

test.describe("Creative inline rich text position parity", () => {
  test("keeps inline editor aligned to static rich text bounds on double-click", async ({ page }) => {
    await createDeckAndOpenEditor(page);

    await page.getByTestId("mode-creative-button").click();
    const creativeCanvas = page.getByTestId("creative-card-canvas");
    await expect(creativeCanvas).toBeVisible();
    await page.getByRole("button", { name: "Select" }).click();

    const staticRichText = page.locator('[data-testid^="creative-richtext-static-"]').first();
    await expect(staticRichText).toBeVisible();

    const staticBox = await staticRichText.boundingBox();
    expect(staticBox).not.toBeNull();
    if (!staticBox) return;

    await page.mouse.dblclick(staticBox.x + 4, staticBox.y + 4);
    const inlineEditor = page.getByTestId("creative-inline-richtext-editor");
    await expect(inlineEditor).toBeVisible();

    const inlineBox = await inlineEditor.boundingBox();
    expect(inlineBox).not.toBeNull();
    if (!inlineBox) return;

    expect(Math.abs(inlineBox.x - staticBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(inlineBox.y - staticBox.y)).toBeLessThanOrEqual(1);
  });
});

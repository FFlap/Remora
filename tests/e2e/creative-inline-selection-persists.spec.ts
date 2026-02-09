import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Inline Selection Deck ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Keep active Fabric selection while editing");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

test.describe("Creative inline selection persistence", () => {
  test("keeps Fabric selection active while typing in inline rich text edit mode", async ({ page }) => {
    await createDeckAndOpenEditor(page);

    const quickEditor = page.locator('[contenteditable="true"]').first();
    await quickEditor.click();
    await page.keyboard.type("Selection persistence anchor");
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId("mode-creative-button").click();
    const creativeCanvas = page.getByTestId("creative-card-canvas");
    await expect(creativeCanvas).toBeVisible();
    await page.getByRole("button", { name: "Select" }).click();

    const staticRichText = page
      .locator('[data-testid^="creative-richtext-static-"]:not([data-testid="creative-richtext-static-layer"])')
      .first();
    await expect(staticRichText).toBeVisible();
    const staticBox = await staticRichText.boundingBox();
    expect(staticBox).not.toBeNull();
    if (!staticBox) return;

    const clickX = staticBox.x + staticBox.width / 2;
    const clickY = staticBox.y + staticBox.height / 2;
    await page.mouse.click(clickX, clickY);
    await page.mouse.dblclick(clickX, clickY);

    const inlineEditor = page.getByTestId("creative-inline-richtext-editor");
    await expect(inlineEditor).toBeVisible();

    const selectedBeforeTyping = await page.evaluate(() => {
      const canvas = (window as any).__remoraCreativeCanvas;
      const active = canvas?.getActiveObject?.();
      return active?.data?.kind === "richText";
    });
    expect(selectedBeforeTyping).toBeTruthy();

    await inlineEditor.locator('[contenteditable="true"]').first().click();
    await page.keyboard.type(" + typing");
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

    const selectedAfterTyping = await page.evaluate(() => {
      const canvas = (window as any).__remoraCreativeCanvas;
      const active = canvas?.getActiveObject?.();
      return active?.data?.kind === "richText";
    });
    expect(selectedAfterTyping).toBeTruthy();
  });
});

import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Rich Format Deck ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Rich format parity");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

test.describe("Rich Text Format Parity", () => {
  test("keeps bold styling and font family consistent across quick preview and creative view", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);

    const token = `BoldToken${Date.now()}`;

    const quickEditor = page.locator('[contenteditable="true"]').first();
    await quickEditor.click();
    await page.keyboard.type(token);
    await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+a`);
    await page.locator('button[title="Bold"]').first().click();

    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("quick-live-preview-card")).toContainText(token);

    const quickPreviewCard = page.getByTestId("quick-live-preview-card");
    const quickWeight = await quickPreviewCard.evaluate((node, tokenValue) => {
      let maxWeight = Number.parseInt(window.getComputedStyle(node).fontWeight, 10) || 0;
      const elements = [node, ...Array.from(node.querySelectorAll("*"))];
      for (const element of elements) {
        if (!element.textContent || !element.textContent.includes(tokenValue)) continue;
        const weight = Number.parseInt(window.getComputedStyle(element).fontWeight, 10) || 0;
        if (weight > maxWeight) maxWeight = weight;
      }
      return maxWeight;
    }, token);
    expect(quickWeight).toBeGreaterThanOrEqual(600);
    const quickFontFamily = await quickPreviewCard.evaluate(
      (node) => window.getComputedStyle(node).fontFamily,
    );

    await page.getByTestId("mode-creative-button").click();
    const creativeCanvas = page.getByTestId("creative-card-canvas");
    await expect(creativeCanvas).toBeVisible();
    const canvasBox = await creativeCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) return;

    await page.getByTestId("creative-tool-select").click();
    await page.mouse.click(canvasBox.x + 130, canvasBox.y + 120);
    await expect(page.getByTestId("creative-richtext-toolbar-row")).toBeVisible();
    await page.getByRole("button", { name: "Edit Text" }).click();
    await expect(page.getByTestId("creative-inline-richtext-editor")).toBeVisible();

    const creativeInlineEditor = page.getByTestId("creative-inline-richtext-editor");
    await expect(creativeInlineEditor).toContainText(token);

    const creativeWeight = await creativeInlineEditor.evaluate((node, tokenValue) => {
      let maxWeight = Number.parseInt(window.getComputedStyle(node).fontWeight, 10) || 0;
      const elements = [node, ...Array.from(node.querySelectorAll("*"))];
      for (const element of elements) {
        if (!element.textContent || !element.textContent.includes(tokenValue)) continue;
        const weight = Number.parseInt(window.getComputedStyle(element).fontWeight, 10) || 0;
        if (weight > maxWeight) maxWeight = weight;
      }
      return maxWeight;
    }, token);
    expect(creativeWeight).toBeGreaterThanOrEqual(600);
    const creativeFontFamily = await creativeInlineEditor.evaluate(
      (node) => window.getComputedStyle(node).fontFamily,
    );

    expect(creativeFontFamily).toEqual(quickFontFamily);
  });
});

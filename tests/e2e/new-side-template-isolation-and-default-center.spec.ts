import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

const MODIFIER_KEY = process.platform === "darwin" ? "Meta" : "Control";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Side Template Isolation ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Side add template isolation + centered first text");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

async function replaceQuickEditorText(page: Parameters<typeof test>[0]["page"], text: string) {
  await page.getByTestId("mode-quick-button").click();
  const quickEditor = page.locator('.quick-editor-input-panel [contenteditable="true"]').first();
  await expect(quickEditor).toBeVisible({ timeout: 12000 });

  await quickEditor.click({ force: true });
  await page.keyboard.press(`${MODIFIER_KEY}+A`);
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText(text);

  await expect
    .poll(async () => ((await quickEditor.textContent()) ?? "").includes(text), { timeout: 12000 })
    .toBeTruthy();
  await expect
    .poll(
      async () =>
        ((await page.getByTestId("quick-live-preview-card").textContent()) ?? "").includes(text),
      { timeout: 12000 },
    )
    .toBeTruthy();
}

test.describe("Side template isolation + centered first text", () => {
  test("keeps first typed token visually centered inside quick preview card", async ({ page }) => {
    const token = `CENTER_${Date.now()}`;
    await createDeckAndOpenEditor(page);
    await replaceQuickEditorText(page, token);

    const card = page.getByTestId("quick-live-preview-card");
    const tokenParagraph = page
      .locator('[data-testid^="quick-live-preview-card-richtext-"] p')
      .filter({ hasText: token })
      .first();

    await expect(card).toBeVisible();
    await expect(tokenParagraph).toBeVisible();

    const [cardBounds, tokenBounds] = await Promise.all([
      card.boundingBox(),
      tokenParagraph.boundingBox(),
    ]);
    expect(cardBounds).not.toBeNull();
    expect(tokenBounds).not.toBeNull();
    if (!cardBounds || !tokenBounds) return;

    const cardCenterX = cardBounds.x + cardBounds.width / 2;
    const cardCenterY = cardBounds.y + cardBounds.height / 2;
    const tokenCenterX = tokenBounds.x + tokenBounds.width / 2;
    const tokenCenterY = tokenBounds.y + tokenBounds.height / 2;

    expect(Math.abs(cardCenterX - tokenCenterX)).toBeLessThanOrEqual(36);
    expect(Math.abs(cardCenterY - tokenCenterY)).toBeLessThanOrEqual(36);
  });

  test("adding a new side from a populated side starts with an empty template (no copied content)", async ({
    page,
  }) => {
    const sourceToken = `SOURCE_${Date.now()}`;
    await createDeckAndOpenEditor(page);
    await replaceQuickEditorText(page, sourceToken);

    await page.getByTestId("side-tray-add-side").click();
    await expect(page.getByTestId("side-tray-item-1")).toBeVisible({ timeout: 12000 });
    await page.getByTestId("side-tray-item-1").click({ force: true });

    const quickEditor = page.locator('.quick-editor-input-panel [contenteditable="true"]').first();
    const quickPreview = page.getByTestId("quick-live-preview-card");
    const sideTrayPreview = page.getByTestId("side-tray-item-1");

    await expect(quickEditor).toBeVisible();
    await expect(quickPreview).toBeVisible();
    await expect(sideTrayPreview).toBeVisible();

    await expect
      .poll(async () => (await quickEditor.textContent()) ?? "", { timeout: 12000 })
      .not.toContain(sourceToken);
    await expect
      .poll(async () => (await quickPreview.textContent()) ?? "", { timeout: 12000 })
      .not.toContain(sourceToken);
    await expect
      .poll(async () => (await sideTrayPreview.textContent()) ?? "", { timeout: 12000 })
      .not.toContain(sourceToken);
  });
});


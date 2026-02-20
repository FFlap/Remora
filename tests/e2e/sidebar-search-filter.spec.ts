import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

const MODIFIER_KEY = process.platform === "darwin" ? "Meta" : "Control";

function parseEditUrl(url: string) {
  const match = url.match(/\/app\/decks\/([^/]+)\/edit\/card\/([^/]+)/);
  if (!match) {
    throw new Error(`Unexpected edit URL format: ${url}`);
  }
  return { deckId: match[1], cardId: match[2] };
}

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Sidebar Search Deck ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Sidebar search regression");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

async function getSidebarCardIds(page: Parameters<typeof test>[0]["page"]) {
  return await page.locator('[data-testid^="card-sidebar-preview-"]').evaluateAll((elements) =>
    elements
      .map((element) => element.getAttribute("data-testid") ?? "")
      .map((testId) => testId.replace("card-sidebar-preview-", ""))
      .filter((id) => id.length > 0),
  );
}

async function waitForNewSidebarCardId(
  page: Parameters<typeof test>[0]["page"],
  existingIds: Set<string>,
) {
  const handle = await page.waitForFunction(
    ({ existing }) => {
      const previews = Array.from(
        document.querySelectorAll<HTMLElement>('[data-testid^="card-sidebar-preview-"]'),
      );
      for (const preview of previews) {
        const testId = preview.getAttribute("data-testid") ?? "";
        const cardId = testId.replace("card-sidebar-preview-", "");
        if (cardId && !existing.includes(cardId)) {
          return cardId;
        }
      }
      return null;
    },
    { existing: [...existingIds] },
    { timeout: 15_000 },
  );

  const value = await handle.jsonValue();
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function replaceQuickEditorText(
  page: Parameters<typeof test>[0]["page"],
  text: string,
  expectedText = text,
) {
  await page.getByTestId("mode-quick-button").click();
  const quickEditor = page.locator('.quick-editor-input-panel [contenteditable="true"]').first();
  await expect(quickEditor).toBeVisible({ timeout: 12000 });

  await quickEditor.click({ force: true });
  await page.keyboard.press(`${MODIFIER_KEY}+A`);
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText(text);

  await expect
    .poll(async () => ((await quickEditor.textContent()) ?? "").includes(expectedText), {
      timeout: 12000,
    })
    .toBeTruthy();
}

async function addSecondTextBlockAndFill(page: Parameters<typeof test>[0]["page"], text: string) {
  await page.getByTestId("mode-creative-button").click();
  await expect(page.getByTestId("creative-add-text-button")).toBeVisible({ timeout: 12000 });
  await page.getByTestId("creative-add-text-button").click();

  await page.getByTestId("mode-quick-button").click();
  const textBlockSelect = page.getByTestId("quick-text-block-select");
  await expect(textBlockSelect).toBeVisible({ timeout: 12000 });
  await textBlockSelect.selectOption({ index: 1 });
  await replaceQuickEditorText(page, text);
  await textBlockSelect.selectOption({ index: 0 });
}

test.describe("Sidebar search filter", () => {
  test("filters editor and viewer sidebars by section title and front-card text (including second text block)", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);

    const initialRoute = parseEditUrl(page.url());
    const deckId = initialRoute.deckId;
    const firstCardId = initialRoute.cardId;

    const firstCardPrimaryText = `alpha-front-${Date.now()}`;
    const firstCardSecondaryText = `second-box-${Date.now()}`;
    const secondCardText = `beta-front-${Date.now()}`;
    const secondCardSecondaryText = `beta-second-box-${Date.now()}`;

    await replaceQuickEditorText(page, firstCardPrimaryText);
    await addSecondTextBlockAndFill(page, firstCardSecondaryText);

    const existingIds = new Set(await getSidebarCardIds(page));
    await page.getByText("Section 1").first().click({ button: "right" });
    await page.getByRole("button", { name: "New card" }).click();

    const discoveredSecondCardId = await waitForNewSidebarCardId(page, existingIds);
    expect(discoveredSecondCardId).toBeTruthy();
    if (!discoveredSecondCardId) {
      return;
    }

    await page.getByTestId(`card-sidebar-preview-${discoveredSecondCardId}`).click();
    await expect(page).toHaveURL(
      new RegExp(`/app/decks/${deckId}/edit/card/${discoveredSecondCardId}$`),
    );
    const secondCardId = discoveredSecondCardId;
    await replaceQuickEditorText(page, secondCardText);
    const textBlockSelect = page.getByTestId("quick-text-block-select");
    if (await textBlockSelect.isVisible().catch(() => false)) {
      await textBlockSelect.selectOption({ index: 1 });
      await replaceQuickEditorText(page, secondCardSecondaryText);
      await textBlockSelect.selectOption({ index: 0 });
    }

    await page.getByTestId("deck-sidebar-add-section").click();
    await expect(page.getByText("Section 2").first()).toBeVisible();
    await expect(page.locator('[data-testid^="card-sidebar-preview-"]')).toHaveCount(3);

    const editorSearch = page.getByTestId("deck-sidebar-search-input");
    await editorSearch.fill(secondCardText);
    await expect(page.locator('[data-testid^="card-sidebar-preview-"]')).toHaveCount(1);
    await expect(page.locator('[data-testid^="card-sidebar-preview-"]').first()).toBeVisible();
    await expect(page.getByTestId("deck-sidebar-section-header").first()).not.toContainText(
      "drag to reorder",
    );

    await editorSearch.fill("Section 2");
    await expect(page.getByText("Section 2").first()).toBeVisible();
    await expect(page.getByText("Section 1").first()).toHaveCount(0);

    await editorSearch.fill("");
    await expect(page.locator('[data-testid^="card-sidebar-preview-"]')).toHaveCount(3);
    await expect(page.getByTestId("deck-sidebar-section-header").first()).toContainText(
      "drag to reorder",
    );

    await page.goto(`/deck/${deckId}/card/${secondCardId}`);
    await expect(page).toHaveURL(new RegExp(`/deck/${deckId}/card/${secondCardId}$`));

    const viewerSearch = page.getByTestId("viewer-sidebar-search-input");
    await viewerSearch.fill(firstCardSecondaryText);
    await expect(page.locator('[data-testid^="viewer-card-item-"]')).toHaveCount(1);
    await expect(page.getByTestId(`viewer-card-item-${firstCardId}`)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/deck/${deckId}/card/${secondCardId}$`));
    await expect(page.getByTestId(`viewer-card-item-${secondCardId}`)).toHaveCount(0);

    await viewerSearch.fill("Section 2");
    await expect(page.locator('[data-testid^="viewer-section-"]')).toHaveCount(1);
    await expect(page.getByText("Section 2").first()).toBeVisible();

    await viewerSearch.fill("no-match-token");
    await expect(page.getByTestId("viewer-sidebar-no-results")).toBeVisible();

    await viewerSearch.fill("");
    await expect(page.locator('[data-testid^="viewer-card-item-"]')).toHaveCount(3);
  });
});

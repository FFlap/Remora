import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

function parseEditorRoute(url: string) {
  const match = url.match(/\/app\/decks\/([^/]+)\/edit\/card\/([^/]+)/);
  if (!match) {
    throw new Error(`Unexpected editor URL format: ${url}`);
  }
  return {
    deckId: match[1],
    cardId: match[2],
  };
}

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Sidebar Switch Parity ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Sidebar active preview race regression");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
  return parseEditorRoute(page.url());
}

async function fillQuickEditor(page: Parameters<typeof test>[0]["page"], text: string) {
  await page.getByTestId("mode-quick-button").click();
  const quickEditor = page.locator('.quick-editor-input-panel [contenteditable="true"]').first();
  await expect(quickEditor).toBeVisible({ timeout: 12000 });
  const selectAllShortcut = `${process.platform === "darwin" ? "Meta" : "Control"}+A`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await quickEditor.click({ force: true });
    await page.keyboard.press(selectAllShortcut);
    await page.keyboard.press("Backspace");
    await page.keyboard.insertText(text);
    const editorText = (await quickEditor.textContent()) ?? "";
    if (editorText.includes(text)) {
      break;
    }
    await page.waitForTimeout(250);
  }

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
  // Quick mode saves with debounce; give persistence/query refresh enough time before switches.
  await page.waitForTimeout(1400);
}

async function sampleCardPreviewText(
  page: Parameters<typeof test>[0]["page"],
  cardPreview: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
  unexpectedToken: string,
) {
  for (let index = 0; index < 12; index += 1) {
    const text = (await cardPreview.textContent()) ?? "";
    expect(text).not.toContain(unexpectedToken);
    await page.waitForTimeout(15);
  }
}

async function readUniqueSidebarCardIds(page: Parameters<typeof test>[0]["page"]) {
  return page
    .locator('[data-testid^="card-sidebar-preview-"]')
    .evaluateAll((nodes) => {
      const ids: string[] = [];
      for (const node of nodes) {
        const raw = node.getAttribute("data-testid");
        if (!raw) continue;
        const id = raw.replace("card-sidebar-preview-", "");
        if (!id) continue;
        if (!ids.includes(id)) {
          ids.push(id);
        }
      }
      return ids;
    });
}

async function selectCardFromSidebar(page: Parameters<typeof test>[0]["page"], cardId: string) {
  const cardPreview = page.getByTestId(`card-sidebar-preview-${cardId}`);
  const urlPattern = new RegExp(`/app/decks/[^/]+/edit/card/${cardId}$`);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await cardPreview.scrollIntoViewIfNeeded();
    await cardPreview.click({ force: true });
    try {
      await expect(page).toHaveURL(urlPattern, { timeout: 3000 });
      return;
    } catch {
      await page.waitForTimeout(150);
    }
  }

  await expect(page).toHaveURL(urlPattern, { timeout: 5000 });
}

test.describe("Sidebar active preview switch regression", () => {
  test("does not briefly show previous card preview while rapidly switching cards", async ({
    page,
  }) => {
    const cardOneToken = "ONE_X";
    const cardTwoToken = "TWO_Y";

    await createDeckAndOpenEditor(page);

    await page.getByText("Section 1").first().click({ button: "right" });
    await page.getByRole("button", { name: "New card" }).click();
    await expect
      .poll(async () => (await readUniqueSidebarCardIds(page)).length, { timeout: 10000 })
      .toBeGreaterThanOrEqual(2);

    const uniqueCardIds = await readUniqueSidebarCardIds(page);
    const [firstCardId, secondCardId] = uniqueCardIds;
    expect(firstCardId).toBeTruthy();
    expect(secondCardId).toBeTruthy();
    expect(firstCardId).not.toBe(secondCardId);

    await selectCardFromSidebar(page, String(firstCardId));
    await fillQuickEditor(page, cardOneToken);

    await selectCardFromSidebar(page, String(secondCardId));
    await fillQuickEditor(page, cardTwoToken);

    await expect
      .poll(
        async () =>
          ((await page.getByTestId(`card-sidebar-preview-${firstCardId}`).textContent()) ?? "").includes(
            cardOneToken,
          ) &&
          ((await page.getByTestId(`card-sidebar-preview-${secondCardId}`).textContent()) ?? "").includes(
            cardTwoToken,
          ),
        { timeout: 22000 },
      )
      .toBeTruthy();

    const cardOneId = String(firstCardId);
    const cardTwoId = String(secondCardId);
    const cardOnePreview = page.getByTestId(`card-sidebar-preview-${cardOneId}`);
    const cardTwoPreview = page.getByTestId(`card-sidebar-preview-${cardTwoId}`);

    await selectCardFromSidebar(page, cardOneId);
    await sampleCardPreviewText(page, cardOnePreview, cardTwoToken);

    await selectCardFromSidebar(page, cardTwoId);
    await sampleCardPreviewText(page, cardTwoPreview, cardOneToken);

    for (let index = 0; index < 4; index += 1) {
      await selectCardFromSidebar(page, cardOneId);
      await sampleCardPreviewText(page, cardOnePreview, cardTwoToken);

      await selectCardFromSidebar(page, cardTwoId);
      await sampleCardPreviewText(page, cardTwoPreview, cardOneToken);

      const cardOneText = (await cardOnePreview.textContent()) ?? "";
      const cardTwoText = (await cardTwoPreview.textContent()) ?? "";
      expect(cardOneText).not.toContain(cardTwoToken);
      expect(cardTwoText).not.toContain(cardOneToken);
    }
  });
});

import { expect, type Page, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

type FrameBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const MODIFIER_KEY = process.platform === "darwin" ? "Meta" : "Control";
const DEFAULT_FRAME: FrameBounds = { left: 38, top: 25, width: 684, height: 458 };

function parseEditorCardId(url: string) {
  const match = url.match(/\/app\/decks\/[^/]+\/edit\/card\/([^/]+)/);
  return match?.[1] ?? null;
}

async function createDeckAndOpenEditor(page: Page) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Centered Frame ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Centered frame regression");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

async function setQuickEditorText(page: Page, text: string) {
  await page.getByTestId("mode-quick-button").click();
  const quickEditor = page.locator('.quick-editor-input-panel [contenteditable="true"]').first();
  await expect(quickEditor).toBeVisible({ timeout: 12_000 });

  await quickEditor.click({ force: true });
  await page.keyboard.press(`${MODIFIER_KEY}+A`);
  await page.keyboard.press("Backspace");
  await page.keyboard.type(text);

  await expect
    .poll(async () => ((await quickEditor.textContent()) ?? "").includes(text), { timeout: 12_000 })
    .toBeTruthy();
}

async function appendCreativeInlineText(page: Page, suffix: string) {
  await page.getByTestId("mode-creative-button").click();
  await page.getByTestId("creative-tool-select").click();
  const inlineEditorRoot = page.getByTestId("creative-inline-richtext-editor");
  const editButton = page.getByRole("button", { name: "Edit Text" });
  const staticRichText = page
    .locator(
      '[data-testid^="creative-richtext-static-"]:not([data-testid="creative-richtext-static-layer"])',
    )
    .first();
  if (await staticRichText.isVisible()) {
    await staticRichText.click({ force: true });
  }

  if (!(await inlineEditorRoot.isVisible())) {
    if (await editButton.isVisible()) {
      await editButton.click();
    }
  }

  if (!(await inlineEditorRoot.isVisible())) {
    const canvas = page.getByTestId("creative-card-canvas");
    await expect(canvas).toBeVisible({ timeout: 8_000 });
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) return;
    await page.mouse.dblclick(canvasBox.x + 140, canvasBox.y + 120);
    await page.waitForTimeout(180);
  }

  const inlineEditor = page
    .getByTestId("creative-inline-richtext-editor")
    .locator('[contenteditable="true"]')
    .first();
  await expect(inlineEditor).toBeVisible({ timeout: 8_000 });
  await inlineEditor.click();
  await inlineEditor.evaluate((node) => {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.keyboard.type(suffix);

  await expect
    .poll(async () => ((await inlineEditor.textContent()) ?? "").includes(suffix), {
      timeout: 12_000,
    })
    .toBeTruthy();

  await page.getByRole("button", { name: "Done" }).click();
}

function readFirstFrame(locator: ReturnType<Page["locator"]>) {
  return locator.evaluate((node) => {
    const first = node.querySelector(":scope > div.absolute") as HTMLElement | null;
    if (!first) return null;
    return {
      left: Number.parseFloat(first.style.left.replace("px", "")),
      top: Number.parseFloat(first.style.top.replace("px", "")),
      width: Number.parseFloat(first.style.width.replace("px", "")),
      height: Number.parseFloat(first.style.height.replace("px", "")),
    };
  }) as Promise<FrameBounds | null>;
}

function assertNearFrame(actual: FrameBounds | null, expected: FrameBounds) {
  expect(actual).not.toBeNull();
  if (!actual) return;
  expect(Math.abs(actual.left - expected.left)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(actual.top - expected.top)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(actual.width - expected.width)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(actual.height - expected.height)).toBeLessThanOrEqual(0.5);
}

async function createNewCardFromSectionMenu(page: Page) {
  await page.getByText("Section 1").first().click({ button: "right" });
  const contextMenu = page.getByRole("menu", { name: "Sidebar context menu" });
  await expect(contextMenu).toBeVisible();
  await contextMenu.getByRole("button", { name: "New card" }).click();
}

test.describe("Centered frame + fresh card template regressions", () => {
  test("keeps centered textbox frame after typing in quick and creative editors", async ({
    page,
  }) => {
    const quickToken = `CENTER_${Date.now()}`;
    const creativeSuffix = "_CREATIVE";

    await createDeckAndOpenEditor(page);
    await setQuickEditorText(page, quickToken);

    const quickContent = page.getByTestId("quick-live-preview-card-content");
    const sidebarContent = page
      .locator('[data-testid^="card-sidebar-preview-"] > div > div')
      .first();
    const trayContent = page.getByTestId("side-tray-item-0").locator(":scope > div > div").first();

    assertNearFrame(await readFirstFrame(quickContent), DEFAULT_FRAME);
    assertNearFrame(await readFirstFrame(sidebarContent), DEFAULT_FRAME);
    assertNearFrame(await readFirstFrame(trayContent), DEFAULT_FRAME);

    await appendCreativeInlineText(page, creativeSuffix);
    await page.getByTestId("mode-quick-button").click();

    assertNearFrame(await readFirstFrame(quickContent), DEFAULT_FRAME);
    assertNearFrame(await readFirstFrame(sidebarContent), DEFAULT_FRAME);
    assertNearFrame(await readFirstFrame(trayContent), DEFAULT_FRAME);

    await expect(page.getByTestId("quick-live-preview-card")).toContainText(quickToken);
    await expect(page.getByTestId("quick-live-preview-card")).toContainText(creativeSuffix);
  });

  test("new card starts with empty default template after previous card text + drawing", async ({
    page,
  }) => {
    const previousToken = `PREV_CARD_${Date.now()}`;
    await createDeckAndOpenEditor(page);
    const firstCardId = parseEditorCardId(page.url());
    expect(firstCardId).toBeTruthy();
    if (!firstCardId) return;

    await setQuickEditorText(page, previousToken);
    await page.getByTestId("mode-creative-button").click();
    const canvas = page.getByTestId("creative-card-canvas");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    await page.getByTestId("creative-tool-draw").click();
    await page.mouse.move(box.x + 160, box.y + 170);
    await page.mouse.down();
    await page.mouse.move(box.x + 540, box.y + 250, { steps: 15 });
    await page.mouse.up();

    await page.getByTestId("mode-quick-button").click();
    await expect(page.getByTestId("quick-live-preview-card")).toContainText(previousToken);
    await expect(
      page.locator('[data-testid="quick-live-preview-card"] [aria-label="Drawing stroke"]'),
    ).toHaveCount(1);

    await createNewCardFromSectionMenu(page);
    await expect
      .poll(() => parseEditorCardId(page.url()) !== firstCardId, { timeout: 15_000 })
      .toBeTruthy();

    const newCardId = parseEditorCardId(page.url());
    expect(newCardId).toBeTruthy();
    expect(newCardId).not.toBe(firstCardId);
    if (!newCardId) return;

    const quickPreview = page.getByTestId("quick-live-preview-card");
    const newSidebarPreview = page.getByTestId(`card-sidebar-preview-${newCardId}`);
    const trayPreview = page.getByTestId("side-tray-item-0");

    await expect(quickPreview).not.toContainText(previousToken);
    await expect(newSidebarPreview).not.toContainText(previousToken);
    await expect(trayPreview).not.toContainText(previousToken);

    await expect(
      page.locator('[data-testid="quick-live-preview-card"] [aria-label="Drawing stroke"]'),
    ).toHaveCount(0);
    await expect(newSidebarPreview.locator('[aria-label="Drawing stroke"]')).toHaveCount(0);
    await expect(trayPreview.locator('[aria-label="Drawing stroke"]')).toHaveCount(0);

    const quickContent = page.getByTestId("quick-live-preview-card-content");
    assertNearFrame(await readFirstFrame(quickContent), DEFAULT_FRAME);
  });
});

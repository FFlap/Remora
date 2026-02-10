import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";
import { CONSISTENCY_LONG_TEXT } from "./utils/longTextFixture";

const MODIFIER_KEY = process.platform === "darwin" ? "Meta" : "Control";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Creative Inline Center ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Creative inline textbox center-until-overflow");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

async function openInlineEditor(page: Parameters<typeof test>[0]["page"]) {
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
  if (await editButton.isVisible()) {
    await editButton.click();
  }

  const inlineRoot = page.getByTestId("creative-inline-richtext-editor");
  await expect(inlineRoot).toBeVisible({ timeout: 12000 });
  await expect(inlineRoot.locator('[contenteditable="true"]').first()).toBeVisible({
    timeout: 12000,
  });
  return inlineRoot;
}

function getComputedAlign(locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>) {
  return locator.evaluate((node) => window.getComputedStyle(node).textAlign);
}

function getActiveCreativeElementId(page: Parameters<typeof test>[0]["page"]) {
  return page.evaluate(() => {
    const canvas = (window as { __remoraCreativeCanvas?: { getActiveObject?: () => unknown } })
      .__remoraCreativeCanvas;
    const activeObject = canvas?.getActiveObject?.() as
      | { data?: { elementId?: string } }
      | undefined;
    return typeof activeObject?.data?.elementId === "string" ? activeObject.data.elementId : null;
  });
}

test.describe("Creative inline textbox center-until-overflow", () => {
  test("keeps placeholder/text centered until overflow, then scrolls", async ({ page }) => {
    const token = `INLINE_CENTER_${Date.now()}`;
    await createDeckAndOpenEditor(page);
    const inlineRoot = await openInlineEditor(page);
    const inlineScrollHost = inlineRoot.locator(".remora-lexical-inline-scroll-host").first();
    await expect(inlineScrollHost).toBeVisible();

    const placeholder = inlineRoot.getByText("Start writing...", { exact: true }).first();
    await expect(placeholder).toBeVisible();

    const placeholderDelta = await inlineRoot.evaluate((node) => {
      const placeholderElement = node.querySelector(
        ".pointer-events-none.absolute",
      ) as HTMLElement | null;
      if (!placeholderElement) return null;
      const rootRect = node.getBoundingClientRect();
      const placeholderRect = placeholderElement.getBoundingClientRect();
      return {
        dx: placeholderRect.left + placeholderRect.width / 2 - (rootRect.left + rootRect.width / 2),
        dy: placeholderRect.top + placeholderRect.height / 2 - (rootRect.top + rootRect.height / 2),
      };
    });
    expect(placeholderDelta).not.toBeNull();
    if (!placeholderDelta) return;
    expect(Math.abs(placeholderDelta.dx)).toBeLessThanOrEqual(36);
    expect(Math.abs(placeholderDelta.dy)).toBeLessThanOrEqual(36);

    const inlineEditable = inlineRoot.locator('[contenteditable="true"]').first();
    await inlineEditable.click({ force: true });
    await inlineEditable.fill(token);
    await expect(inlineRoot).toContainText(token);

    const shortTextCenterDelta = await inlineRoot.evaluate((node) => {
      const paragraph = node.querySelector('[contenteditable="true"] p') as HTMLElement | null;
      if (!paragraph) return null;
      const rootRect = node.getBoundingClientRect();
      const paragraphRect = paragraph.getBoundingClientRect();
      return paragraphRect.top + paragraphRect.height / 2 - (rootRect.top + rootRect.height / 2);
    });
    expect(shortTextCenterDelta).not.toBeNull();
    if (shortTextCenterDelta == null) return;
    expect(Math.abs(shortTextCenterDelta)).toBeLessThanOrEqual(48);

    await inlineEditable.fill(CONSISTENCY_LONG_TEXT);
    await expect
      .poll(async () =>
        inlineScrollHost.evaluate((node) => {
          const editable = node.querySelector('[contenteditable="true"]') as HTMLElement | null;
          const candidates = [node as HTMLElement, editable].filter(
            (value): value is HTMLElement => value !== null,
          );
          const target =
            candidates.find((candidate) => candidate.scrollHeight > candidate.clientHeight + 1) ??
            null;
          return target !== null;
        }),
      )
      .toBeTruthy();

    const scrollTop = await inlineScrollHost.evaluate((node) => {
      const editable = node.querySelector('[contenteditable="true"]') as HTMLElement | null;
      const candidates = [node as HTMLElement, editable].filter(
        (value): value is HTMLElement => value !== null,
      );
      const target =
        candidates.find((candidate) => candidate.scrollHeight > candidate.clientHeight + 1) ?? null;
      if (!target) return 0;
      target.scrollTop = 0;
      target.scrollTop += 900;
      return target.scrollTop;
    });
    expect(scrollTop).toBeGreaterThan(0);
  });

  test("keeps textbox selected when changing alignment in inline edit mode", async ({ page }) => {
    await createDeckAndOpenEditor(page);
    const inlineRoot = await openInlineEditor(page);
    const inlineEditable = inlineRoot.locator('[contenteditable="true"]').first();
    await inlineEditable.click({ force: true });
    await inlineEditable.fill("creative alignment persistence");
    const activeBefore = await getActiveCreativeElementId(page);
    expect(activeBefore).not.toBeNull();
    if (!activeBefore) return;

    const creativeToolbar = page.getByTestId("creative-richtext-toolbar-row");
    await expect(creativeToolbar).toBeVisible();
    await expect(creativeToolbar.getByRole("button", { name: "Done" })).toBeVisible();
    await expect(creativeToolbar.locator('button[title="Bold"]').first()).toBeEnabled();

    await creativeToolbar.getByRole("button", { name: "Text alignment" }).click();
    await page.getByRole("menuitem", { name: "Right" }).click();

    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({
      timeout: 20000,
    });
    await expect.poll(async () => getActiveCreativeElementId(page)).toBe(activeBefore);
    await expect(creativeToolbar.getByRole("button", { name: "Done" })).toBeVisible();
    await expect(creativeToolbar.locator('button[title="Bold"]').first()).toBeEnabled();
    const inlineParagraph = inlineRoot.locator('[contenteditable="true"] p').first();
    await expect.poll(async () => getComputedAlign(inlineParagraph)).toBe("right");
  });

  test("changes alignment only for the active line in inline edit mode", async ({ page }) => {
    await createDeckAndOpenEditor(page);
    const inlineRoot = await openInlineEditor(page);
    const inlineEditable = inlineRoot.locator('[contenteditable="true"]').first();
    await inlineEditable.click({ force: true });
    await page.keyboard.type("first line");
    await page.keyboard.press("Enter");
    await page.keyboard.type("second line");

    const paragraphs = inlineRoot.locator('[contenteditable="true"] p');
    await expect(paragraphs).toHaveCount(2);

    const creativeToolbar = page.getByTestId("creative-richtext-toolbar-row");
    await expect(creativeToolbar).toBeVisible();

    await inlineEditable.click({ force: true });
    await page.keyboard.press(`${MODIFIER_KEY}+A`);
    await creativeToolbar.getByRole("button", { name: "Text alignment" }).click();
    await page.getByRole("menuitem", { name: "Left" }).click();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({
      timeout: 20000,
    });
    await expect.poll(async () => getComputedAlign(paragraphs.nth(0))).toBe("left");
    await expect.poll(async () => getComputedAlign(paragraphs.nth(1))).toBe("left");

    await paragraphs.nth(1).click({ force: true });
    await creativeToolbar.getByRole("button", { name: "Text alignment" }).click();
    await page.getByRole("menuitem", { name: "Right" }).click();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({
      timeout: 20000,
    });

    await expect.poll(async () => getComputedAlign(paragraphs.nth(0))).toBe("left");
    await expect.poll(async () => getComputedAlign(paragraphs.nth(1))).toBe("right");
  });

  test("changes alignment only for the active bullet item in inline edit mode", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);
    const inlineRoot = await openInlineEditor(page);
    const inlineEditable = inlineRoot.locator('[contenteditable="true"]').first();
    await inlineEditable.click({ force: true });
    await page.keyboard.insertText("first bullet");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("second bullet");

    const creativeToolbar = page.getByTestId("creative-richtext-toolbar-row");
    await expect(creativeToolbar).toBeVisible();
    await inlineEditable.click({ force: true });
    await page.keyboard.press(`${MODIFIER_KEY}+A`);
    await creativeToolbar.locator('button[title="Bullet List"]').first().click();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({
      timeout: 20000,
    });

    const listItems = inlineRoot.locator('[contenteditable="true"] li');
    await expect(listItems).toHaveCount(2);

    await listItems.nth(0).click({ force: true });
    await creativeToolbar.getByRole("button", { name: "Text alignment" }).click();
    await page.getByRole("menuitem", { name: "Left" }).click();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({
      timeout: 20000,
    });

    await listItems.nth(1).click({ force: true });
    await creativeToolbar.getByRole("button", { name: "Text alignment" }).click();
    await page.getByRole("menuitem", { name: "Right" }).click();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({
      timeout: 20000,
    });

    await expect.poll(async () => getComputedAlign(listItems.nth(0))).toBe("left");
    await expect.poll(async () => getComputedAlign(listItems.nth(1))).toBe("right");
  });
});

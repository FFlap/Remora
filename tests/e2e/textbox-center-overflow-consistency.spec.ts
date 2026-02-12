import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";
import { CONSISTENCY_LONG_TEXT } from "./utils/longTextFixture";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Textbox Overflow Consistency ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Textbox center-until-overflow consistency");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

function quickPreviewRichText(page: Parameters<typeof test>[0]["page"]) {
  return page.locator('[data-testid^="quick-live-preview-card-richtext-"]').first();
}

function sidebarPreviewRichText(page: Parameters<typeof test>[0]["page"]) {
  return page.locator('[data-testid^="card-sidebar-preview-"] .remora-preview-scroll').first();
}

function creativeStaticRichText(page: Parameters<typeof test>[0]["page"]) {
  return page
    .locator(
      '[data-testid^="creative-richtext-static-"]:not([data-testid="creative-richtext-static-layer"]) .remora-preview-scroll',
    )
    .first();
}

async function expectCenteredFrame(
  locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
) {
  await expect(locator).toBeVisible();
  await expect
    .poll(async () =>
      locator.evaluate((node) => node.classList.contains("remora-richtext-frame-centered")),
    )
    .toBeTruthy();
}

async function expectPlaceholderCentered(
  locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
) {
  await expectCenteredFrame(locator);
  await expect
    .poll(async () =>
      locator.evaluate((node) =>
        Boolean(node.querySelector(".remora-richtext-content-empty span")),
      ),
    )
    .toBeTruthy();
  const centeredDelta = await locator.evaluate((node) => {
    const placeholder = node.querySelector(
      ".remora-richtext-content-empty span",
    ) as HTMLElement | null;
    if (!placeholder) return null;
    const frame = node.getBoundingClientRect();
    const value = placeholder.getBoundingClientRect();
    return {
      dx: value.left + value.width / 2 - (frame.left + frame.width / 2),
      dy: value.top + value.height / 2 - (frame.top + frame.height / 2),
    };
  });
  expect(centeredDelta).not.toBeNull();
  if (!centeredDelta) return;
  expect(Math.abs(centeredDelta.dx)).toBeLessThanOrEqual(36);
  expect(Math.abs(centeredDelta.dy)).toBeLessThanOrEqual(36);
}

async function expectShortTextCentered(
  locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
  token: string,
) {
  await expectCenteredFrame(locator);
  await expect(locator).toContainText(token);
  const centeredDelta = await locator.evaluate((node) => {
    const content = node.querySelector(".remora-richtext-content") as HTMLElement | null;
    const firstBlock = content?.firstElementChild as HTMLElement | null;
    if (!content || !firstBlock) return null;
    const frame = node.getBoundingClientRect();
    const value = firstBlock.getBoundingClientRect();
    return {
      dy: value.top + value.height / 2 - (frame.top + frame.height / 2),
    };
  });
  expect(centeredDelta).not.toBeNull();
  if (!centeredDelta) return;
  expect(Math.abs(centeredDelta.dy)).toBeLessThanOrEqual(48);
}

async function expectOverflowing(
  locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
) {
  await expect(locator).toBeVisible();
  await expect
    .poll(async () => locator.evaluate((node) => node.scrollHeight > node.clientHeight + 1))
    .toBeTruthy();
  const scrollbarWidth = await locator.evaluate((node) => getComputedStyle(node).scrollbarWidth);
  expect(scrollbarWidth).not.toBe("none");
}

function scrollAndReadScrollTop(
  locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
) {
  return locator.evaluate((node) => {
    node.scrollTop = 0;
    const maxScrollTop = Math.max(0, node.scrollHeight - node.clientHeight);
    if (maxScrollTop <= 0) return 0;
    node.scrollTop = Math.max(24, Math.floor(maxScrollTop * 0.5));
    return node.scrollTop;
  });
}

test.describe("Textbox center-until-overflow consistency", () => {
  test("keeps centered placeholder/text and consistent overflow across quick, sidebar, and creative", async ({
    page,
  }) => {
    const token = `CENTER_${Date.now()}`;
    await createDeckAndOpenEditor(page);

    const quickRichText = quickPreviewRichText(page);
    const sidebarRichText = sidebarPreviewRichText(page);
    await expectPlaceholderCentered(quickRichText);
    await expectPlaceholderCentered(sidebarRichText);

    await page.getByTestId("mode-creative-button").click();
    const creativeRichText = creativeStaticRichText(page);
    await expectPlaceholderCentered(creativeRichText);

    await page.getByTestId("mode-quick-button").click();
    const editor = page.locator('.quick-editor-input-panel [contenteditable="true"]').first();
    await editor.click();
    await editor.fill(token);
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 20000 });

    await expectShortTextCentered(quickRichText, token);
    await expectShortTextCentered(sidebarRichText, token);

    await page.getByTestId("mode-creative-button").click();
    await expectShortTextCentered(creativeRichText, token);

    await page.getByTestId("mode-quick-button").click();
    await editor.click();
    await editor.fill(CONSISTENCY_LONG_TEXT);
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 20000 });

    await expectOverflowing(quickRichText);
    await expectOverflowing(sidebarRichText);

    const quickScrollTop = await scrollAndReadScrollTop(quickRichText);
    expect(quickScrollTop).toBeGreaterThan(0);

    const sidebarScrollTop = await scrollAndReadScrollTop(sidebarRichText);
    expect(sidebarScrollTop).toBeGreaterThan(0);

    await page.getByTestId("mode-creative-button").click();
    await expectOverflowing(creativeRichText);
    const creativeScrollTop = await scrollAndReadScrollTop(creativeRichText);
    expect(creativeScrollTop).toBeGreaterThan(0);
  });
});

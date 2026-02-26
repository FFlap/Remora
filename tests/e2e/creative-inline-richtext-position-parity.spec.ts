import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Inline Position Deck ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Creative inline rich text position parity");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

test.describe("Creative inline rich text position parity", () => {
  test("keeps inline editor aligned to static rich text bounds on double-click", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);

    const quickEditor = page.locator('[contenteditable="true"]').first();
    await quickEditor.click();
    await page.keyboard.type("Inline parity anchor text");
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId("mode-creative-button").click();
    const creativeCanvas = page.getByTestId("creative-card-canvas");
    await expect(creativeCanvas).toBeVisible();
    await page.getByTestId("creative-tool-select").click();

    const staticRichText = page
      .locator(
        '[data-testid^="creative-richtext-static-"]:not([data-testid="creative-richtext-static-layer"])',
      )
      .first();
    await expect(staticRichText).toBeVisible();

    const staticBox = await staticRichText.boundingBox();
    expect(staticBox).not.toBeNull();
    if (!staticBox) return;

    const staticTextRect = await staticRichText.evaluate((node) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
        acceptNode(textNode) {
          return textNode.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        },
      });
      const textNode = walker.nextNode();
      if (!textNode || !textNode.textContent) return null;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, Math.min(1, textNode.textContent.length));
      const rect = range.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    });
    expect(staticTextRect).not.toBeNull();
    if (!staticTextRect) return;

    const clickX = staticBox.x + staticBox.width / 2;
    const clickY = staticBox.y + staticBox.height / 2;
    await page.mouse.click(clickX, clickY);
    await page.mouse.dblclick(clickX, clickY);
    const inlineEditor = page.getByTestId("creative-inline-richtext-editor");
    await expect(inlineEditor).toBeVisible();

    const inlineBox = await inlineEditor.boundingBox();
    expect(inlineBox).not.toBeNull();
    if (!inlineBox) return;

    expect(Math.abs(inlineBox.x - staticBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(inlineBox.y - staticBox.y)).toBeLessThanOrEqual(1);

    const inlineTextRect = await inlineEditor.evaluate((node) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
        acceptNode(textNode) {
          return textNode.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        },
      });
      const textNode = walker.nextNode();
      if (!textNode || !textNode.textContent) return null;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, Math.min(1, textNode.textContent.length));
      const rect = range.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    });
    expect(inlineTextRect).not.toBeNull();
    if (!inlineTextRect) return;

    expect(Math.abs(inlineTextRect.x - staticTextRect.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(inlineTextRect.y - staticTextRect.y)).toBeLessThanOrEqual(1);
  });
});

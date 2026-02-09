import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Preview Scroll Deck ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Preview rich text hover scroll");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

test.describe("Preview rich text hover scroll", () => {
  test("scrolls long rich text content inside quick preview on hover + wheel", async ({ page }) => {
    await createDeckAndOpenEditor(page);

    const quickEditor = page.locator('[contenteditable="true"]').first();
    await quickEditor.click();
    const longLines = Array.from({ length: 40 }, (_, i) => `Line ${i + 1} preview overflow token`).join("\n");
    await quickEditor.fill(longLines);
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

    const previewRichText = page.locator('[data-testid^="quick-live-preview-card-richtext-"]').first();
    await expect(previewRichText).toBeVisible();

    const hasOverflow = await previewRichText.evaluate(
      (node) => node.scrollHeight > node.clientHeight + 1,
    );
    expect(hasOverflow).toBeTruthy();

    const box = await previewRichText.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(24, box.height / 2));
    const before = await previewRichText.evaluate((node) => node.scrollTop);
    await previewRichText.evaluate((node) => {
      node.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: 720,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await expect
      .poll(() => previewRichText.evaluate((node) => node.scrollTop), { timeout: 2000 })
      .toBeGreaterThan(before);
  });
});

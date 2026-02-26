import { expect, type Page, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Page) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Hover Wheel Deck ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Hover wheel scroll behavior");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

test.describe("Hover surface wheel scroll", () => {
  test("quick content row scrolls when wheeling over the preview card", async ({ page }) => {
    await createDeckAndOpenEditor(page);
    await page.setViewportSize({ width: 1400, height: 560 });

    const contentRow = page.getByTestId("editor-content-row");
    const card = page.getByTestId("quick-live-preview-card");
    await expect(contentRow).toBeVisible();
    await expect(card).toBeVisible();

    await contentRow.evaluate((node) => {
      node.scrollTop = 0;
    });
    const rowOverflows = await contentRow.evaluate(
      (node) => node.scrollHeight > node.clientHeight + 1,
    );
    expect(rowOverflows).toBeTruthy();

    const rowBox = await contentRow.boundingBox();
    const cardBox = await card.boundingBox();
    expect(rowBox).not.toBeNull();
    expect(cardBox).not.toBeNull();
    if (!rowBox || !cardBox) return;

    const overlapLeft = Math.max(rowBox.x, cardBox.x);
    const overlapRight = Math.min(rowBox.x + rowBox.width, cardBox.x + cardBox.width);
    const overlapTop = Math.max(rowBox.y, cardBox.y);
    const overlapBottom = Math.min(rowBox.y + rowBox.height, cardBox.y + cardBox.height);
    expect(overlapRight - overlapLeft).toBeGreaterThan(4);
    expect(overlapBottom - overlapTop).toBeGreaterThan(4);

    await page.mouse.move((overlapLeft + overlapRight) / 2, (overlapTop + overlapBottom) / 2);
    const before = await contentRow.evaluate((node) => node.scrollTop);
    await page.mouse.wheel(0, 900);

    await expect
      .poll(() => contentRow.evaluate((node) => node.scrollTop), { timeout: 4000 })
      .toBeGreaterThan(before + 1);
  });

  test("sidebar list scrolls when wheeling over a card preview", async ({ page }) => {
    await createDeckAndOpenEditor(page);
    await page.setViewportSize({ width: 1280, height: 620 });

    for (let index = 0; index < 10; index += 1) {
      await page.getByTestId("deck-sidebar-add-section").click();
    }

    await expect
      .poll(async () => page.locator('[data-testid^="card-sidebar-preview-"]').count(), {
        timeout: 15000,
      })
      .toBe(11);

    const sidebarScroll = page.getByTestId("deck-sidebar-scroll");
    await expect(sidebarScroll).toBeVisible();
    await sidebarScroll.evaluate((node) => {
      node.scrollTop = 0;
    });

    const sidebarOverflows = await sidebarScroll.evaluate(
      (node) => node.scrollHeight > node.clientHeight + 1,
    );
    expect(sidebarOverflows).toBeTruthy();

    const cardInSidebar = page.locator('[data-testid^="card-sidebar-preview-"]').nth(1);
    await expect(cardInSidebar).toBeVisible();

    const cardBox = await cardInSidebar.boundingBox();
    expect(cardBox).not.toBeNull();
    if (!cardBox) return;

    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    const before = await sidebarScroll.evaluate((node) => node.scrollTop);
    await page.mouse.wheel(0, 1200);

    await expect
      .poll(() => sidebarScroll.evaluate((node) => node.scrollTop), { timeout: 4000 })
      .toBeGreaterThan(before + 1);
  });
});

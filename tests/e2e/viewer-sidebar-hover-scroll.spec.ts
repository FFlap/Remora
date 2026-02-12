import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

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

  await page.getByPlaceholder("Biology Midterm").fill(`Viewer Sidebar Scroll Deck ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Viewer sidebar hover-wheel scroll behavior");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

test.describe("Viewer sidebar hover scroll", () => {
  test("scrolls sidebar when wheeling over a card preview surface", async ({ page }) => {
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

    const { deckId } = parseEditUrl(page.url());
    await page.goto(`/deck/${deckId}`);
    await expect(page.getByTestId("viewer-sidebar")).toBeVisible();

    const sidebarScroll = page.getByTestId("viewer-sidebar-scroll");
    await expect(sidebarScroll).toBeVisible();

    await sidebarScroll.evaluate((node) => {
      node.scrollTop = 0;
    });

    const sidebarOverflows = await sidebarScroll.evaluate(
      (node) => node.scrollHeight > node.clientHeight + 1,
    );
    expect(sidebarOverflows).toBeTruthy();

    const cardInSidebar = page.locator('[data-testid^="viewer-card-item-"]').nth(1);
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

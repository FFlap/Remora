import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Sidebar Drag Deck ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Sidebar full-card drag");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

test.describe("Sidebar full-card drag", () => {
  test("reorders cards by dragging the card preview itself (no drag handle)", async ({ page }) => {
    await createDeckAndOpenEditor(page);

    await page.getByText("Section 1").first().click({ button: "right" });
    await page.getByRole("button", { name: "New card" }).click();
    await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);

    const cardPreviews = page.locator('[data-testid^="card-sidebar-preview-"]');
    await expect(cardPreviews).toHaveCount(2);
    const beforeOrder = await cardPreviews.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-testid") ?? ""),
    );
    expect(beforeOrder[0]).toBeTruthy();
    expect(beforeOrder[1]).toBeTruthy();
    expect(beforeOrder[0]).not.toBe(beforeOrder[1]);

    const firstBox = await cardPreviews.nth(0).boundingBox();
    const secondBox = await cardPreviews.nth(1).boundingBox();
    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();
    if (!firstBox || !secondBox) return;

    await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      secondBox.x + secondBox.width / 2,
      secondBox.y + secondBox.height / 2,
      { steps: 15 },
    );
    await page.mouse.up();

    await expect(page.getByText(/was dropped over droppable area/i)).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Sidebar Section Bounds ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Section drag boundaries");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

test.describe("Sidebar section drag boundaries", () => {
  test("keeps section drag within sidebar viewport and still reorders", async ({ page }) => {
    await createDeckAndOpenEditor(page);

    for (let index = 0; index < 5; index += 1) {
      await page.getByTestId("deck-sidebar-add-section").click();
    }

    const sectionItems = page.getByTestId("deck-sidebar-section-item");
    const sectionHeaders = page.getByTestId("deck-sidebar-section-header");
    await expect
      .poll(async () => sectionItems.count(), {
        timeout: 15000,
      })
      .toBe(6);

    const beforeOrder = await sectionHeaders.evaluateAll((nodes) =>
      nodes.map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim()),
    );
    const sidebarBox = await page.getByTestId("deck-sidebar-scroll").boundingBox();
    const firstHeaderBox = await sectionHeaders.nth(0).boundingBox();
    const lastHeaderBox = await sectionHeaders.nth(5).boundingBox();
    expect(sidebarBox).not.toBeNull();
    expect(firstHeaderBox).not.toBeNull();
    expect(lastHeaderBox).not.toBeNull();
    if (!sidebarBox || !firstHeaderBox || !lastHeaderBox) return;

    await page.mouse.move(
      firstHeaderBox.x + firstHeaderBox.width / 2,
      firstHeaderBox.y + firstHeaderBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(firstHeaderBox.x - 640, firstHeaderBox.y - 700, {
      steps: 24,
    });

    const draggedTop = await sectionItems.nth(0).boundingBox();
    expect(draggedTop).not.toBeNull();
    if (!draggedTop) return;
    expect(draggedTop.x).toBeGreaterThanOrEqual(sidebarBox.x - 1);
    expect(draggedTop.y).toBeGreaterThanOrEqual(sidebarBox.y - 1);

    await page.mouse.move(firstHeaderBox.x + 16, firstHeaderBox.y + 1600, {
      steps: 40,
    });
    const draggedBottom = await sectionItems.nth(0).boundingBox();
    expect(draggedBottom).not.toBeNull();
    if (!draggedBottom) return;
    expect(draggedBottom.x + draggedBottom.width).toBeLessThanOrEqual(
      sidebarBox.x + sidebarBox.width + 1,
    );
    expect(draggedBottom.y + draggedBottom.height).toBeLessThanOrEqual(
      sidebarBox.y + sidebarBox.height + 1,
    );

    await page.mouse.move(
      lastHeaderBox.x + lastHeaderBox.width / 2,
      lastHeaderBox.y + lastHeaderBox.height / 2,
      {
        steps: 24,
      },
    );
    await page.mouse.up();

    await expect
      .poll(
        async () =>
          JSON.stringify(
            await sectionHeaders.evaluateAll((nodes) =>
              nodes.map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim()),
            ),
          ),
        { timeout: 12000 },
      )
      .not.toBe(JSON.stringify(beforeOrder));
  });
});

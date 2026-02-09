import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

type Box = { x: number; y: number; width: number; height: number };

const RICH_TEXT_STATIC_SELECTOR =
  '[data-testid^="creative-richtext-static-"]:not([data-testid="creative-richtext-static-layer"])';

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Multi Select Deck ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Creative multi-select drag persistence");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

function getRichTextStaticBoxes(page: Parameters<typeof test>[0]["page"]): Promise<Box[]> {
  return page.locator(RICH_TEXT_STATIC_SELECTOR).evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })
      .filter((box) => box.width > 4 && box.height > 4),
  );
}

function center(box: Box) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

test.describe("Creative multi-select movement", () => {
  test("persists moving multiple selected text boxes", async ({ page }) => {
    await createDeckAndOpenEditor(page);

    await page.getByTestId("mode-creative-button").click();
    const creativeCanvas = page.getByTestId("creative-card-canvas");
    await expect(creativeCanvas).toBeVisible();

    await page.getByTestId("creative-add-text-button").click();
    const doneButton = page.getByRole("button", { name: "Done" });
    if ((await doneButton.count()) > 0) {
      await doneButton.first().click();
    }

    const canvasBox = await creativeCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) return;

    // Move the newly-added text box so the two text boxes are separable.
    await page.getByTestId("creative-tool-select").click();
    await page.mouse.move(canvasBox.x + 170, canvasBox.y + 130);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 330, canvasBox.y + 260, { steps: 10 });
    await page.mouse.up();

    await expect.poll(async () => (await getRichTextStaticBoxes(page)).length).toBeGreaterThanOrEqual(2);
    const beforeBoxes = (await getRichTextStaticBoxes(page)).slice(0, 2);
    expect(beforeBoxes.length).toBe(2);

    const beforeCenters = beforeBoxes.map(center);

    const minX = Math.min(...beforeBoxes.map((box) => box.x));
    const minY = Math.min(...beforeBoxes.map((box) => box.y));
    const maxX = Math.max(...beforeBoxes.map((box) => box.x + box.width));
    const maxY = Math.max(...beforeBoxes.map((box) => box.y + box.height));
    const marqueeStart = { x: minX - 30, y: minY - 30 };
    const marqueeEnd = { x: maxX + 30, y: maxY + 30 };

    await page.mouse.move(marqueeStart.x, marqueeStart.y);
    await page.mouse.down();
    await page.mouse.move(marqueeEnd.x, marqueeEnd.y, { steps: 12 });
    await page.mouse.up();

    const dragOffset = { x: 86, y: 58 };
    const dragStart = {
      x: (beforeCenters[0].x + beforeCenters[1].x) / 2,
      y: (beforeCenters[0].y + beforeCenters[1].y) / 2,
    };
    await page.mouse.move(dragStart.x, dragStart.y);
    await page.mouse.down();
    await page.mouse.move(dragStart.x + dragOffset.x, dragStart.y + dragOffset.y, {
      steps: 14,
    });
    await page.mouse.up();

    await page.getByTestId("mode-quick-button").click();
    await page.getByTestId("mode-creative-button").click();
    await expect(creativeCanvas).toBeVisible();

    await expect.poll(async () => (await getRichTextStaticBoxes(page)).length).toBeGreaterThanOrEqual(2);
    const afterBoxes = (await getRichTextStaticBoxes(page)).slice(0, 2);
    const afterCenters = afterBoxes.map(center);

    const deltaA = {
      x: afterCenters[0].x - beforeCenters[0].x,
      y: afterCenters[0].y - beforeCenters[0].y,
    };
    const deltaB = {
      x: afterCenters[1].x - beforeCenters[1].x,
      y: afterCenters[1].y - beforeCenters[1].y,
    };

    const movedDistanceA = Math.hypot(deltaA.x, deltaA.y);
    const movedDistanceB = Math.hypot(deltaB.x, deltaB.y);

    expect(movedDistanceA).toBeGreaterThan(8);
    expect(movedDistanceB).toBeGreaterThan(8);
    expect(Math.abs(deltaA.x - deltaB.x)).toBeLessThanOrEqual(8);
    expect(Math.abs(deltaA.y - deltaB.y)).toBeLessThanOrEqual(8);
  });
});

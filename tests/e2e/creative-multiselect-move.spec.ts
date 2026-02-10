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
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Creative multi-select drag persistence");
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

function isInside(box: Box, point: { x: number; y: number }, padding = 0) {
  return (
    point.x >= box.x + padding &&
    point.x <= box.x + box.width - padding &&
    point.y >= box.y + padding &&
    point.y <= box.y + box.height - padding
  );
}

function uniqueClickPoint(box: Box, other: Box) {
  const inset = 10;
  const candidates = [
    { x: box.x + inset, y: box.y + inset },
    { x: box.x + box.width - inset, y: box.y + inset },
    { x: box.x + inset, y: box.y + box.height - inset },
    { x: box.x + box.width - inset, y: box.y + box.height - inset },
    center(box),
  ];

  return candidates.find((point) => !isInside(other, point, 2)) ?? center(box);
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: This suite keeps the full multi-select drag persistence scenario in one place to avoid flaky cross-test state.
test.describe("Creative multi-select movement", () => {
  // biome-ignore lint/complexity/noExcessiveLinesPerFunction: This e2e test intentionally validates end-to-end selection, drag, persistence, and cross-mode replay together.
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
    await page.mouse.move(canvasBox.x + 250, canvasBox.y + 210, { steps: 10 });
    await page.mouse.up();

    await expect
      .poll(async () => (await getRichTextStaticBoxes(page)).length)
      .toBeGreaterThanOrEqual(2);
    const beforeBoxes = (await getRichTextStaticBoxes(page)).slice(0, 2);
    expect(beforeBoxes.length).toBe(2);

    const beforeCenters = beforeBoxes.map(center);

    const clickA = uniqueClickPoint(beforeBoxes[0], beforeBoxes[1]);
    const clickB = uniqueClickPoint(beforeBoxes[1], beforeBoxes[0]);

    await page.mouse.click(clickA.x, clickA.y);
    await page.keyboard.down("Shift");
    await page.mouse.click(clickB.x, clickB.y);
    await page.keyboard.up("Shift");

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const canvas = (
              window as { __remoraCreativeCanvas?: { getActiveObject?: () => unknown } }
            ).__remoraCreativeCanvas;
            const active = canvas?.getActiveObject?.() as
              | { getObjects?: () => unknown[] }
              | undefined;
            return active && typeof active === "object" && typeof active.getObjects === "function"
              ? active.getObjects().length
              : 0;
          }),
        { timeout: 8000 },
      )
      .toBeGreaterThanOrEqual(2);

    const selectionSizeAfterMarquee = await page.evaluate(() => {
      const canvas = (window as { __remoraCreativeCanvas?: { getActiveObject?: () => unknown } })
        .__remoraCreativeCanvas;
      const active = canvas?.getActiveObject?.() as { getObjects?: () => unknown[] } | undefined;
      return active && typeof active === "object" && typeof active.getObjects === "function"
        ? active.getObjects().length
        : 0;
    });
    expect(selectionSizeAfterMarquee).toBeGreaterThanOrEqual(2);

    const selectionBounds = {
      minX: Math.min(...beforeBoxes.map((box) => box.x)),
      minY: Math.min(...beforeBoxes.map((box) => box.y)),
      maxX: Math.max(...beforeBoxes.map((box) => box.x + box.width)),
      maxY: Math.max(...beforeBoxes.map((box) => box.y + box.height)),
    };
    const stageBounds = {
      minX: canvasBox.x + 6,
      minY: canvasBox.y + 6,
      maxX: canvasBox.x + canvasBox.width - 6,
      maxY: canvasBox.y + canvasBox.height - 6,
    };

    const availableLeft = Math.max(0, selectionBounds.minX - stageBounds.minX);
    const availableRight = Math.max(0, stageBounds.maxX - selectionBounds.maxX);
    const availableUp = Math.max(0, selectionBounds.minY - stageBounds.minY);
    const availableDown = Math.max(0, stageBounds.maxY - selectionBounds.maxY);

    const dragOffset = {
      x:
        availableLeft >= availableRight
          ? -Math.min(64, Math.max(18, availableLeft - 2))
          : Math.min(64, Math.max(18, availableRight - 2)),
      y:
        availableUp >= availableDown
          ? -Math.min(44, Math.max(12, availableUp - 2))
          : Math.min(44, Math.max(12, availableDown - 2)),
    };

    const dragStart = {
      x: Math.min(Math.max(beforeCenters[0].x, stageBounds.minX + 4), stageBounds.maxX - 4),
      y: Math.min(Math.max(beforeCenters[0].y, stageBounds.minY + 4), stageBounds.maxY - 4),
    };
    await page.mouse.move(dragStart.x, dragStart.y);
    await page.mouse.down();
    await page.mouse.move(dragStart.x + dragOffset.x, dragStart.y + dragOffset.y, {
      steps: 14,
    });
    await page.mouse.up();

    await expect
      .poll(async () => {
        const moved = (await getRichTextStaticBoxes(page)).slice(0, 2).map(center);
        if (moved.length < 2) return 0;
        const first = Math.hypot(moved[0].x - beforeCenters[0].x, moved[0].y - beforeCenters[0].y);
        const second = Math.hypot(moved[1].x - beforeCenters[1].x, moved[1].y - beforeCenters[1].y);
        return Math.min(first, second);
      })
      .toBeGreaterThan(8);

    const afterDragBoxes = (await getRichTextStaticBoxes(page)).slice(0, 2);
    expect(afterDragBoxes.length).toBe(2);

    await page.getByTestId("mode-quick-button").click();
    await page.getByTestId("mode-creative-button").click();
    await expect(creativeCanvas).toBeVisible();

    await expect
      .poll(async () => (await getRichTextStaticBoxes(page)).length)
      .toBeGreaterThanOrEqual(2);
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

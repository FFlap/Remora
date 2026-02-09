import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

type StrokeSnapshot = {
  d: string;
  viewBox: string;
  stroke: string;
  style: {
    left: string;
    top: string;
    width: string;
    height: string;
    transform: string;
  };
};

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Perspective Deck ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Perspective parity test");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

async function drawStroke(
  page: Parameters<typeof test>[0]["page"],
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.getByTestId("creative-tool-draw").click();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();
}

function getQuickStrokeSnapshot(
  page: Parameters<typeof test>[0]["page"],
): Promise<StrokeSnapshot[]> {
  return page.getByTestId("quick-live-preview-card").evaluate((node) => {
    const paths = Array.from(node.querySelectorAll("svg path"));
    return paths.map((path) => {
      const svg = path.closest("svg");
      const wrapper = svg?.parentElement as HTMLElement | null;
      return {
        d: path.getAttribute("d") ?? "",
        viewBox: svg?.getAttribute("viewBox") ?? "",
        stroke: path.getAttribute("stroke") ?? "",
        style: {
          left: wrapper?.style.left ?? "",
          top: wrapper?.style.top ?? "",
          width: wrapper?.style.width ?? "",
          height: wrapper?.style.height ?? "",
          transform: wrapper?.style.transform ?? "",
        },
      };
    });
  });
}

test.describe("Quick/Create perspective parity", () => {
  test("keeps drawing perspective identical between Creative canvas and Quick preview across switches", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);

    await page.getByTestId("mode-creative-button").click();
    const creativeCanvas = page.getByTestId("creative-card-canvas");
    await expect(creativeCanvas).toBeVisible();

    const canvasBox = await creativeCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) return;

    await drawStroke(
      page,
      { x: canvasBox.x + 80, y: canvasBox.y + 90 },
      { x: canvasBox.x + canvasBox.width - 90, y: canvasBox.y + 110 },
    );
    await drawStroke(
      page,
      { x: canvasBox.x + 140, y: canvasBox.y + canvasBox.height - 70 },
      { x: canvasBox.x + canvasBox.width - 140, y: canvasBox.y + 150 },
    );

    await page.getByTestId("mode-quick-button").click();
    const quickPreview = page.getByTestId("quick-live-preview-card");
    await expect(quickPreview).toBeVisible();
    await expect
      .poll(async () => quickPreview.locator("svg path").count(), { timeout: 10000 })
      .toBeGreaterThanOrEqual(1);

    const quickBox = await quickPreview.boundingBox();
    expect(quickBox).not.toBeNull();
    if (!quickBox) return;

    const creativeRatio = canvasBox.width / canvasBox.height;
    const quickRatio = quickBox.width / quickBox.height;
    expect(Math.abs(creativeRatio - quickRatio)).toBeLessThan(0.02);

    const firstSnapshot = await getQuickStrokeSnapshot(page);
    expect(firstSnapshot.length).toBeGreaterThanOrEqual(1);

    await page.getByTestId("mode-creative-button").click();
    await expect(creativeCanvas).toBeVisible();
    await page.getByTestId("creative-tool-select").click();

    await page.getByTestId("mode-quick-button").click();
    await expect(quickPreview.locator("svg path")).toHaveCount(firstSnapshot.length);
    const secondSnapshot = await getQuickStrokeSnapshot(page);
    expect(secondSnapshot).toEqual(firstSnapshot);

    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await page.keyboard.type(" Perspective text");
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId("mode-creative-button").click();
    await expect(creativeCanvas).toBeVisible();
    await page.getByTestId("mode-quick-button").click();
    await expect(quickPreview.locator("svg path")).toHaveCount(firstSnapshot.length);
    const thirdSnapshot = await getQuickStrokeSnapshot(page);
    expect(thirdSnapshot).toEqual(firstSnapshot);
  });
});

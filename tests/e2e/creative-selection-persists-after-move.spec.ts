import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Selection Persist Deck ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Selection should persist after move");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

test.describe("Creative selection persistence", () => {
  test("keeps moved text box selected after move/save rehydrate", async ({ page }) => {
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

    await page.getByTestId("creative-tool-select").click();
    await page.mouse.move(canvasBox.x + 180, canvasBox.y + 130);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 260, canvasBox.y + 210, { steps: 12 });
    await page.mouse.up();

    const stillSelected = await page.evaluate(() => {
      const canvas = (
        window as Window & {
          __remoraCreativeCanvas?: {
            getActiveObject?: () => {
              data?: {
                kind?: string;
              };
            } | null;
          };
        }
      ).__remoraCreativeCanvas;
      const active = canvas?.getActiveObject?.();
      return active?.data?.kind === "richText";
    });
    expect(stillSelected).toBeTruthy();

    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });
  });
});

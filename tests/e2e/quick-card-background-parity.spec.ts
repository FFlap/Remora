import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Background Parity Deck ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Quick/Creative card background parity");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

test.describe("Quick card background parity", () => {
  test("applies quick card background color to live preview, sidebar preview, and creative canvas", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);

    const targetHex = "#dbeafe";
    const targetRgb = "rgb(219, 234, 254)";

    const picker = page.getByTestId("quick-card-bg-color-picker");
    await picker.fill(targetHex);
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

    const quickPreview = page.getByTestId("quick-live-preview-card");
    await expect(quickPreview).toBeVisible();
    await expect
      .poll(async () =>
        quickPreview.evaluate((node) => getComputedStyle(node as HTMLElement).backgroundColor),
      )
      .toBe(targetRgb);

    const sidebarPreviewCard = page.locator('[data-testid^="card-sidebar-preview-"] > div').first();
    await expect(sidebarPreviewCard).toBeVisible();
    await expect
      .poll(async () =>
        sidebarPreviewCard.evaluate(
          (node) => getComputedStyle(node as HTMLElement).backgroundColor,
        ),
      )
      .toBe(targetRgb);

    await page.getByTestId("mode-creative-button").click();
    const creativeCanvas = page.getByTestId("creative-card-canvas");
    const creativeShell = page.getByTestId("creative-card-shell");
    await expect(creativeCanvas).toBeVisible();
    await expect(creativeShell).toBeVisible();

    await expect
      .poll(async () =>
        creativeShell.evaluate((node) => getComputedStyle(node as HTMLElement).backgroundColor),
      )
      .toBe(targetRgb);

    await page.getByTestId("mode-quick-button").click();
    await expect
      .poll(async () =>
        quickPreview.evaluate((node) => getComputedStyle(node as HTMLElement).backgroundColor),
      )
      .toBe(targetRgb);
  });
});

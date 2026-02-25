import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

const MODIFIER_KEY = process.platform === "darwin" ? "Meta" : "Control";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Quick Preview Dots ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Quick live preview side dots");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

async function typeQuickText(page: Parameters<typeof test>[0]["page"], token: string) {
  await page.getByTestId("mode-quick-button").click();
  const editor = page.locator('.quick-editor-input-panel [contenteditable="true"]').first();
  await editor.click();
  await page.keyboard.press(`${MODIFIER_KEY}+A`);
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText(token);
  await expect
    .poll(async () => ((await editor.textContent()) ?? "").includes(token), { timeout: 12000 })
    .toBeTruthy();
  await expect
    .poll(
      async () =>
        ((await page.getByTestId("quick-live-preview-card").textContent()) ?? "").includes(token),
      { timeout: 12000 },
    )
    .toBeTruthy();
  await page.waitForTimeout(900);
}

async function deleteSideViaTrayContextMenu(
  page: Parameters<typeof test>[0]["page"],
  sideIndex: number,
) {
  await page.getByTestId(`side-tray-item-${sideIndex}`).click({ button: "right" });
  const sideMenu = page.getByRole("menu", { name: "Side tray context menu" });
  await expect(sideMenu).toBeVisible();
  await sideMenu.getByRole("button", { name: "Delete side" }).click();
}

async function dragSideByIndex(
  page: Parameters<typeof test>[0]["page"],
  sourceIndex: number,
  targetIndex: number,
) {
  const source = page.getByTestId(`side-tray-item-${sourceIndex}`);
  const target = page.getByTestId(`side-tray-item-${targetIndex}`);
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  if (!sourceBox || !targetBox) return;

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 20,
  });
  await page.mouse.up();
}

test.describe("Quick live preview side dots", () => {
  test("stays synchronized with side selection, add, delete, and reorder", async ({ page }) => {
    const sideOneToken = `alpha-${Date.now()}`;
    const sideTwoToken = `beta-${Date.now()}`;
    const sideThreeToken = `gamma-${Date.now()}`;

    await createDeckAndOpenEditor(page);

    await page.getByTestId("side-tray-item-0").click();
    await expect(page.getByTestId("side-tray-item-0")).toHaveAttribute("aria-pressed", "true");
    await typeQuickText(page, sideOneToken);

    await page.getByTestId("side-tray-item-1").click();
    await expect(page.getByTestId("side-tray-item-1")).toHaveAttribute("aria-pressed", "true");
    await typeQuickText(page, sideTwoToken);

    await expect(page.getByTestId("quick-live-preview-side-nav")).toBeVisible();
    await expect(page.locator('[data-testid^="quick-live-preview-side-dot-"]')).toHaveCount(2);

    await page.getByTestId("quick-live-preview-side-dot-0").click();
    await expect(page.getByTestId("side-tray-item-0")).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(
        async () =>
          ((await page.getByTestId("quick-live-preview-card").textContent()) ?? "").includes(
            sideOneToken,
          ),
        { timeout: 12000 },
      )
      .toBeTruthy();

    await page.getByTestId("quick-live-preview-side-dot-1").click();
    await expect(page.getByTestId("side-tray-item-1")).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(
        async () =>
          ((await page.getByTestId("quick-live-preview-card").textContent()) ?? "").includes(
            sideTwoToken,
          ),
        { timeout: 12000 },
      )
      .toBeTruthy();

    await page.getByTestId("side-tray-add-side").click();
    await expect
      .poll(async () => page.locator('[data-testid^="side-tray-item-"]').count(), {
        timeout: 15000,
      })
      .toBe(3);
    await expect(page.locator('[data-testid^="quick-live-preview-side-dot-"]')).toHaveCount(3);

    await page.getByTestId("side-tray-item-2").click();
    await expect(page.getByTestId("side-tray-item-2")).toHaveAttribute("aria-pressed", "true");
    await typeQuickText(page, sideThreeToken);

    await page.getByTestId("quick-live-preview-side-dot-2").click();
    await expect(page.getByTestId("side-tray-item-2")).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(
        async () =>
          ((await page.getByTestId("quick-live-preview-card").textContent()) ?? "").includes(
            sideThreeToken,
          ),
        { timeout: 12000 },
      )
      .toBeTruthy();

    await deleteSideViaTrayContextMenu(page, 2);
    await expect
      .poll(async () => page.locator('[data-testid^="side-tray-item-"]').count(), {
        timeout: 15000,
      })
      .toBe(2);
    await expect(page.locator('[data-testid^="quick-live-preview-side-dot-"]')).toHaveCount(2);

    await dragSideByIndex(page, 0, 1);
    await expect
      .poll(
        async () =>
          ((await page.getByTestId("side-tray-item-0").textContent()) ?? "").includes(sideTwoToken),
        { timeout: 12000 },
      )
      .toBeTruthy();

    await page.getByTestId("quick-live-preview-side-dot-0").click();
    await expect(page.getByTestId("side-tray-item-0")).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(
        async () =>
          ((await page.getByTestId("quick-live-preview-card").textContent()) ?? "").includes(
            sideTwoToken,
          ),
        { timeout: 12000 },
      )
      .toBeTruthy();
  });
});

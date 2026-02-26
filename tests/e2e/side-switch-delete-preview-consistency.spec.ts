import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Side Switch Consistency ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Side switching and delete preview regression");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

async function typeQuickText(page: Parameters<typeof test>[0]["page"], token: string) {
  await page.getByTestId("mode-quick-button").click();
  const editor = page.locator('.quick-editor-input-panel [contenteditable="true"]').first();
  await editor.click();
  await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+A`);
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
  // Quick mode saves with debounce; let the side persist before switching.
  await page.waitForTimeout(900);
}

async function assertActivePreviewToken(
  page: Parameters<typeof test>[0]["page"],
  unexpectedToken: string,
) {
  const preview = page.getByTestId("quick-live-preview-card");

  for (let index = 0; index < 10; index += 1) {
    const text = (await preview.textContent()) ?? "";
    expect(text).not.toContain(unexpectedToken);
    await page.waitForTimeout(12);
  }
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

async function seedTwoSides(
  page: Parameters<typeof test>[0]["page"],
  tokenOne: string,
  tokenTwo: string,
) {
  await createDeckAndOpenEditor(page);

  await page.getByTestId("side-tray-item-0").click();
  await expect(page.getByTestId("side-tray-item-0")).toHaveAttribute("aria-pressed", "true");
  await typeQuickText(page, tokenOne);

  await page.getByTestId("side-tray-item-1").click();
  await expect(page.getByTestId("side-tray-item-1")).toHaveAttribute("aria-pressed", "true");
  await typeQuickText(page, tokenTwo);

  await page.getByTestId("side-tray-item-0").click();
  await expect(page.getByTestId("side-tray-item-0")).toHaveAttribute("aria-pressed", "true");
}

test.describe("Side switch + delete preview consistency", () => {
  test("rapidly switching sides never shows the other side token in active quick preview", async ({
    page,
  }) => {
    const sideOneToken = "ZX";
    const sideTwoToken = "QJ";
    await seedTwoSides(page, sideOneToken, sideTwoToken);

    for (let index = 0; index < 8; index += 1) {
      await page.getByTestId("side-tray-item-0").click();
      await expect(page.getByTestId("side-tray-item-0")).toHaveAttribute("aria-pressed", "true");
      await assertActivePreviewToken(page, sideTwoToken);

      await page.getByTestId("side-tray-item-1").click();
      await expect(page.getByTestId("side-tray-item-1")).toHaveAttribute("aria-pressed", "true");
      await assertActivePreviewToken(page, sideOneToken);
    }
  });

  test("deleting side 0 immediately updates tray and active quick preview to surviving side", async ({
    page,
  }) => {
    const removedToken = "ZX";
    const survivorToken = "QJ";
    await seedTwoSides(page, removedToken, survivorToken);

    await page.getByTestId("side-tray-item-0").click();
    await expect(page.getByTestId("side-tray-item-0")).toHaveAttribute("aria-pressed", "true");
    await assertActivePreviewToken(page, survivorToken);

    await deleteSideViaTrayContextMenu(page, 0);
    await expect
      .poll(async () => page.locator('[data-testid^="side-tray-item-"]').count(), {
        timeout: 15000,
      })
      .toBe(1);
    await expect(page.getByTestId("side-tray-item-0")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("side-tray-item-0").click({ button: "right" });
    await expect(
      page.getByRole("menu", { name: "Side tray context menu" }).getByRole("button", {
        name: "Delete side",
      }),
    ).toBeDisabled();

    await assertActivePreviewToken(page, removedToken);
    await expect
      .poll(
        async () =>
          ((await page.getByTestId("quick-live-preview-card").textContent()) ?? "").includes(
            survivorToken,
          ),
        { timeout: 12000 },
      )
      .toBeTruthy();
    await expect
      .poll(
        async () =>
          ((await page.getByTestId("quick-live-preview-card").textContent()) ?? "").includes(
            removedToken,
          ),
        { timeout: 12000 },
      )
      .toBeFalsy();

    await page.waitForTimeout(1500);
    await expect(page.locator('[data-testid^="side-tray-item-"]')).toHaveCount(1);
  });

  test("context-menu delete still works after side reorder", async ({ page }) => {
    const removedToken = "ZX";
    const survivorToken = "QJ";
    await seedTwoSides(page, removedToken, survivorToken);

    await dragSideByIndex(page, 0, 1);
    await expect
      .poll(
        async () =>
          ((await page.getByTestId("side-tray-item-0").textContent()) ?? "").includes(
            survivorToken,
          ),
        { timeout: 12000 },
      )
      .toBeTruthy();

    await deleteSideViaTrayContextMenu(page, 1);
    await expect
      .poll(async () => page.locator('[data-testid^="side-tray-item-"]').count(), {
        timeout: 15000,
      })
      .toBe(1);
    await expect
      .poll(
        async () =>
          ((await page.getByTestId("quick-live-preview-card").textContent()) ?? "").includes(
            removedToken,
          ),
        { timeout: 12000 },
      )
      .toBeFalsy();
  });
});

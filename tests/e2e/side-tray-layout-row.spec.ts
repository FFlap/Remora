import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Side Tray Row Deck ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Side tray row layout verification");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

async function expectTrayBelowEditorContent(page: Parameters<typeof test>[0]["page"]) {
  const contentRow = page.getByTestId("editor-content-row");
  const trayRow = page.getByTestId("editor-side-tray-row");
  const trayScroll = page.getByTestId("side-tray");

  await expect(contentRow).toBeVisible();
  await expect(trayRow).toBeVisible();
  await expect(trayScroll).toBeVisible();

  const contentBox = await contentRow.boundingBox();
  const trayBox = await trayRow.boundingBox();
  expect(contentBox).not.toBeNull();
  expect(trayBox).not.toBeNull();
  if (!contentBox || !trayBox) return;

  expect(contentBox.y + contentBox.height).toBeLessThanOrEqual(trayBox.y + 1);
  expect(trayBox.height).toBeGreaterThan(100);
}

async function expectVisibleWithinViewport(
  page: Parameters<typeof test>[0]["page"],
  locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;

  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function expectQuickPreviewFullyVisibleOrScrollable(
  page: Parameters<typeof test>[0]["page"],
) {
  const previewCard = page.getByTestId("quick-live-preview-card");
  await expect(previewCard).toBeVisible();

  const metrics = await page.evaluate(() => {
    const stage = document.querySelector(
      '[data-testid="editor-content-row"]',
    ) as HTMLElement | null;
    const card = document.querySelector(
      '[data-testid="quick-live-preview-card"]',
    ) as HTMLElement | null;
    if (!stage || !card) return null;

    const stageRect = stage.getBoundingClientRect();
    const within = (cardRect: DOMRect) =>
      cardRect.top >= stageRect.top - 1 &&
      cardRect.left >= stageRect.left - 1 &&
      cardRect.bottom <= stageRect.bottom + 1 &&
      cardRect.right <= stageRect.right + 1;

    stage.scrollTop = 0;
    const atStart = card.getBoundingClientRect();
    const maxScroll = Math.max(0, stage.scrollHeight - stage.clientHeight);
    stage.scrollTop = maxScroll;
    const atEnd = card.getBoundingClientRect();
    stage.scrollTop = 0;

    return {
      fullyVisible: within(atStart),
      topVisibleAtStart: atStart.top >= stageRect.top - 1,
      bottomVisibleAtEnd: atEnd.bottom <= stageRect.bottom + 1,
    };
  });

  expect(metrics).not.toBeNull();
  if (!metrics) return;

  expect(
    metrics.fullyVisible || (metrics.topVisibleAtStart && metrics.bottomVisibleAtEnd),
  ).toBeTruthy();
}

async function expectPanelVisibleOrReachableViaEditorScroll(
  panel: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
) {
  await expect(panel).toBeVisible();
  const metrics = await panel.evaluate((node) => {
    const contentRow = document.querySelector(
      '[data-testid="editor-content-row"]',
    ) as HTMLElement | null;
    if (!contentRow) return null;
    const rowRect = contentRow.getBoundingClientRect();

    const within = (rect: DOMRect) =>
      rect.top >= rowRect.top - 1 &&
      rect.left >= rowRect.left - 1 &&
      rect.bottom <= rowRect.bottom + 1 &&
      rect.right <= rowRect.right + 1;

    contentRow.scrollTop = 0;
    const atStart = node.getBoundingClientRect();
    const maxScroll = Math.max(0, contentRow.scrollHeight - contentRow.clientHeight);
    contentRow.scrollTop = maxScroll;
    const atEnd = node.getBoundingClientRect();
    contentRow.scrollTop = 0;

    return {
      fullyVisible: within(atStart),
      topVisibleAtStart: atStart.top >= rowRect.top - 1,
      bottomVisibleAtEnd: atEnd.bottom <= rowRect.bottom + 1,
    };
  });

  expect(metrics).not.toBeNull();
  if (!metrics) return;

  expect(
    metrics.fullyVisible || (metrics.topVisibleAtStart && metrics.bottomVisibleAtEnd),
  ).toBeTruthy();
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

async function expectTopControlsDoNotOverlap(page: Parameters<typeof test>[0]["page"]) {
  const modeControls = page.getByTestId("editor-mode-controls");
  const historyControls = page.getByTestId("editor-history-controls");
  await expectVisibleWithinViewport(page, modeControls);
  await expectVisibleWithinViewport(page, historyControls);

  const modeBox = await modeControls.boundingBox();
  const historyBox = await historyControls.boundingBox();
  expect(modeBox).not.toBeNull();
  expect(historyBox).not.toBeNull();
  if (!modeBox || !historyBox) return;

  expect(boxesOverlap(modeBox, historyBox)).toBeFalsy();
}

async function setSideToken(
  page: Parameters<typeof test>[0]["page"],
  sideIndex: number,
  token: string,
) {
  await page.getByTestId("mode-quick-button").click();
  await page.getByTestId(`side-tray-item-${sideIndex}`).click();
  await expect(page.getByTestId(`side-tray-item-${sideIndex}`)).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const editor = page.locator('.quick-editor-input-panel [contenteditable="true"]').first();
  await expect(editor).toBeVisible();
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
  // Let debounced autosave persist before side switches/reorders.
  await page.waitForTimeout(900);
}

function getSideTokenOrder(page: Parameters<typeof test>[0]["page"], tokens: string[]) {
  return page.locator('[data-testid^="side-tray-item-"]').evaluateAll(
    (nodes, allTokens) =>
      nodes.map((node) => {
        const text = node.textContent ?? "";
        const found = allTokens.find((token) => text.includes(token));
        return found ?? "";
      }),
    tokens,
  );
}

async function dragSideByToken(
  page: Parameters<typeof test>[0]["page"],
  sourceToken: string,
  targetToken: string,
) {
  const source = page
    .locator('[data-testid^="side-tray-item-"]')
    .filter({ hasText: sourceToken })
    .first();
  const target = page
    .locator('[data-testid^="side-tray-item-"]')
    .filter({ hasText: targetToken })
    .first();
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

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Keep all tray-layout viewport assertions in one describe for deterministic editor setup.
test.describe("Bottom side tray row layout", () => {
  test("keeps side tray as a dedicated row in quick and creative modes", async ({ page }) => {
    await createDeckAndOpenEditor(page);

    await expectTrayBelowEditorContent(page);

    await page.getByTestId("mode-creative-button").click();
    await expect(page.getByTestId("creative-card-stage")).toBeVisible();
    await expectTrayBelowEditorContent(page);

    await page.getByTestId("mode-quick-button").click();
    await expect(page.getByTestId("quick-live-preview-card")).toBeVisible();
    await expectTrayBelowEditorContent(page);
  });

  test("supports horizontal overflow and selecting off-screen sides", async ({ page }) => {
    test.setTimeout(90000);
    await createDeckAndOpenEditor(page);
    await page.setViewportSize({ width: 980, height: 860 });

    for (let index = 0; index < 24; index += 1) {
      await page.getByTestId("side-tray-add-side").click();
    }

    await expect
      .poll(async () => page.locator('[data-testid^="side-tray-item-"]').count(), {
        timeout: 15000,
      })
      .toBe(26);

    await expect
      .poll(async () =>
        page
          .getByTestId("side-tray-add-side")
          .evaluate((node) => !node.closest('[data-testid="side-tray"]')),
      )
      .toBeTruthy();

    const pinMetrics = await page.evaluate(() => {
      const tray = document.querySelector('[data-testid="side-tray"]') as HTMLElement | null;
      const addTile = document.querySelector(
        '[data-testid="side-tray-add-side"]',
      ) as HTMLElement | null;
      const firstSide = document.querySelector(
        '[data-testid="side-tray-item-0"]',
      ) as HTMLElement | null;
      if (!tray || !addTile || !firstSide) return null;

      tray.scrollLeft = 0;
      const start = {
        scrollLeft: tray.scrollLeft,
        addTileX: addTile.getBoundingClientRect().left,
        firstSideX: firstSide.getBoundingClientRect().left,
      };

      tray.scrollLeft = Math.max(0, tray.scrollWidth - tray.clientWidth);
      const end = {
        scrollLeft: tray.scrollLeft,
        addTileX: addTile.getBoundingClientRect().left,
        firstSideX: firstSide.getBoundingClientRect().left,
      };

      return { start, end };
    });
    expect(pinMetrics).not.toBeNull();
    if (!pinMetrics) return;

    expect(pinMetrics.end.scrollLeft).toBeGreaterThan(pinMetrics.start.scrollLeft + 1);
    expect(Math.abs(pinMetrics.end.addTileX - pinMetrics.start.addTileX)).toBeLessThanOrEqual(2);
    expect(Math.abs(pinMetrics.end.firstSideX - pinMetrics.start.firstSideX)).toBeGreaterThan(20);

    const lastSide = page.getByTestId("side-tray-item-25");
    await lastSide.scrollIntoViewIfNeeded();
    await lastSide.click();
    await expect(lastSide).toHaveAttribute("aria-pressed", "true");
  });

  test("scrolls side tray by wheel while hovering the side area", async ({ page }) => {
    test.setTimeout(90000);
    await createDeckAndOpenEditor(page);
    await page.setViewportSize({ width: 980, height: 860 });

    for (let index = 0; index < 24; index += 1) {
      await page.getByTestId("side-tray-add-side").click();
    }

    await expect
      .poll(async () => page.locator('[data-testid^="side-tray-item-"]').count(), {
        timeout: 15000,
      })
      .toBe(26);

    const tray = page.getByTestId("side-tray");
    await expect(tray).toBeVisible();
    await tray.evaluate((node) => {
      node.scrollLeft = 0;
    });
    const trayOverflows = await tray.evaluate((node) => node.scrollWidth > node.clientWidth + 1);
    expect(trayOverflows).toBeTruthy();

    const trayBox = await tray.boundingBox();
    expect(trayBox).not.toBeNull();
    if (!trayBox) return;

    await page.mouse.move(trayBox.x + trayBox.width / 2, trayBox.y + trayBox.height / 2);
    const before = await tray.evaluate((node) => node.scrollLeft);
    await page.mouse.wheel(0, 1200);

    await expect
      .poll(() => tray.evaluate((node) => node.scrollLeft), { timeout: 4000 })
      .toBeGreaterThan(before + 1);
  });

  test("reorders sides by dragging full tiles, keeps active side content, and persists after reload", async ({
    page,
  }) => {
    const tokenA = `SIDE_A_${Date.now()}`;
    const tokenB = `SIDE_B_${Date.now()}`;
    const tokenC = `SIDE_C_${Date.now()}`;
    await createDeckAndOpenEditor(page);

    await setSideToken(page, 0, tokenA);
    await setSideToken(page, 1, tokenB);
    await page.getByTestId("side-tray-add-side").click();
    await expect(page.getByTestId("side-tray-item-2")).toBeVisible({ timeout: 12000 });
    await setSideToken(page, 2, tokenC);

    await page
      .locator('[data-testid^="side-tray-item-"]')
      .filter({ hasText: tokenB })
      .first()
      .click();
    await expect
      .poll(
        async () =>
          ((await page.getByTestId("quick-live-preview-card").textContent()) ?? "").includes(
            tokenB,
          ),
        { timeout: 12000 },
      )
      .toBeTruthy();

    await dragSideByToken(page, tokenB, tokenC);

    const expectedOrder = [tokenA, tokenC, tokenB];
    await expect
      .poll(async () => getSideTokenOrder(page, [tokenA, tokenB, tokenC]))
      .toEqual(expectedOrder);
    await expect
      .poll(
        async () =>
          ((await page.getByTestId("quick-live-preview-card").textContent()) ?? "").includes(
            tokenB,
          ),
        { timeout: 12000 },
      )
      .toBeTruthy();

    const orderBeforeReload = await getSideTokenOrder(page, [tokenA, tokenB, tokenC]);
    await page.reload();
    await expect(page.getByTestId("editor-side-tray-row")).toBeVisible();
    await expect
      .poll(async () => getSideTokenOrder(page, [tokenA, tokenB, tokenC]), { timeout: 12000 })
      .toEqual(orderBeforeReload);
  });

  test("shows side-tray context menu and closes on outside click or escape", async ({ page }) => {
    await createDeckAndOpenEditor(page);

    const firstSide = page.getByTestId("side-tray-item-0");
    await expect(firstSide).toBeVisible();
    await firstSide.click({ button: "right" });

    const sideMenu = page.getByRole("menu", { name: "Side tray context menu" });
    await expect(sideMenu).toBeVisible();
    await expect(sideMenu.getByRole("button", { name: "Delete side" })).toBeVisible();

    await page.mouse.click(5, 5);
    await expect(sideMenu).toHaveCount(0);

    await firstSide.click({ button: "right" });
    await expect(sideMenu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sideMenu).toHaveCount(0);
  });

  test("keeps add, right-click delete, select behavior and min-side delete guard", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);

    const addTile = page.getByTestId("side-tray-add-side");
    await expect(addTile).toBeVisible();

    const addTileInTray = await addTile.evaluate((node) => {
      return Boolean(node.closest('[data-testid="side-tray"]'));
    });
    expect(addTileInTray).toBeTruthy();

    const firstSide = page.getByTestId("side-tray-item-0");
    await expect(firstSide).toBeVisible();
    const [addTileBox, firstSideBox] = await Promise.all([
      addTile.boundingBox(),
      firstSide.boundingBox(),
    ]);
    expect(addTileBox).not.toBeNull();
    expect(firstSideBox).not.toBeNull();
    if (!addTileBox || !firstSideBox) return;
    expect(Math.abs(addTileBox.width - firstSideBox.width)).toBeLessThanOrEqual(2);

    await addTile.click();
    await expect
      .poll(async () => page.locator('[data-testid^="side-tray-item-"]').count(), {
        timeout: 10000,
      })
      .toBe(3);

    await page.getByTestId("side-tray-item-0").click();
    await expect(page.getByTestId("side-tray-item-0")).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("side-tray-item-1").click({ button: "right" });
    const sideMenu = page.getByRole("menu", { name: "Side tray context menu" });
    await expect(sideMenu).toBeVisible();
    await sideMenu.getByRole("button", { name: "Delete side" }).click();

    await expect
      .poll(async () => page.locator('[data-testid^="side-tray-item-"]').count(), {
        timeout: 10000,
      })
      .toBe(2);
    await expect(page.getByTestId("side-tray-item-0")).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("side-tray-item-0").click({ button: "right" });
    await expect(sideMenu).toBeVisible();
    await sideMenu.getByRole("button", { name: "Delete side" }).click();

    await expect
      .poll(async () => page.locator('[data-testid^="side-tray-item-"]').count(), {
        timeout: 10000,
      })
      .toBe(1);

    await page.getByTestId("side-tray-item-0").click();
    await expect(page.getByTestId("side-tray-item-0")).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("side-tray-item-0").click({ button: "right" });
    await expect(sideMenu).toBeVisible();
    await expect(sideMenu.getByRole("button", { name: "Delete side" })).toBeDisabled();
  });

  test("keeps quick input, preview, and bottom tray visible across responsive viewports", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);
    await page.getByTestId("mode-quick-button").click();

    const viewports = [
      { width: 2560, height: 1400 },
      { width: 1536, height: 960 },
      { width: 1720, height: 620 },
      { width: 1600, height: 540 },
      { width: 1460, height: 560 },
      { width: 1366, height: 768 },
      { width: 1280, height: 820 },
      { width: 1280, height: 720 },
      { width: 1200, height: 560 },
      { width: 1100, height: 760 },
      { width: 980, height: 700 },
      { width: 900, height: 660 },
      { width: 820, height: 900 },
      { width: 768, height: 1024 },
      { width: 720, height: 620 },
      { width: 640, height: 640 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.getByTestId("editor-content-row").evaluate((node) => {
        node.scrollTop = 0;
      });
      await expectTopControlsDoNotOverlap(page);

      const inputPanel = page.locator(".quick-editor-input-panel").first();
      const previewPanel = page.locator(".quick-editor-preview-panel").first();
      const trayRow = page.getByTestId("editor-side-tray-row");

      await expectPanelVisibleOrReachableViaEditorScroll(inputPanel);
      await expectPanelVisibleOrReachableViaEditorScroll(previewPanel);
      await expectQuickPreviewFullyVisibleOrScrollable(page);
      await expectVisibleWithinViewport(page, trayRow);

      const inputBox = await inputPanel.boundingBox();
      const previewBox = await previewPanel.boundingBox();
      const trayBox = await trayRow.boundingBox();
      if (!inputBox || !previewBox || !trayBox) continue;

      const layoutMode = await page
        .getByTestId("quick-editor-surface-grid")
        .getAttribute("data-layout");
      expect(layoutMode).not.toBeNull();

      if (layoutMode === "split") {
        expect(boxesOverlap(inputBox, trayBox)).toBeFalsy();
        expect(boxesOverlap(previewBox, trayBox)).toBeFalsy();
        expect(trayBox.y).toBeGreaterThanOrEqual(Math.max(inputBox.y, previewBox.y));
        expect(previewBox.x).toBeGreaterThanOrEqual(inputBox.x + 40);
        expect(boxesOverlap(inputBox, previewBox)).toBeFalsy();
      } else {
        expect(previewBox.y).toBeLessThanOrEqual(inputBox.y + 1);
      }
    }
  });

  test("keeps creative stage and bottom tray visible across responsive viewports", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);
    await page.getByTestId("mode-creative-button").click();
    await expect(page.getByTestId("creative-card-stage")).toBeVisible();

    const viewports = [
      { width: 2560, height: 1400 },
      { width: 1536, height: 960 },
      { width: 1720, height: 620 },
      { width: 1600, height: 540 },
      { width: 1460, height: 560 },
      { width: 1366, height: 768 },
      { width: 1280, height: 720 },
      { width: 1200, height: 560 },
      { width: 1100, height: 760 },
      { width: 980, height: 700 },
      { width: 900, height: 660 },
      { width: 820, height: 900 },
      { width: 768, height: 1024 },
      { width: 720, height: 620 },
      { width: 640, height: 640 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.getByTestId("editor-content-row").evaluate((node) => {
        node.scrollTop = 0;
      });
      await expectTopControlsDoNotOverlap(page);

      const stage = page.getByTestId("creative-card-stage");
      const cardShell = page.getByTestId("creative-card-shell");
      const trayRow = page.getByTestId("editor-side-tray-row");

      await expectVisibleWithinViewport(page, stage);
      await expectVisibleWithinViewport(page, cardShell);
      await expectVisibleWithinViewport(page, trayRow);

      const stageBox = await stage.boundingBox();
      const trayBox = await trayRow.boundingBox();
      if (!stageBox || !trayBox) continue;
      expect(boxesOverlap(stageBox, trayBox)).toBeFalsy();
      expect(stageBox.y + stageBox.height).toBeLessThanOrEqual(trayBox.y + 1);
    }
  });
});

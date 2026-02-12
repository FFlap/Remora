import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

type ProjectionEntry = {
  left: string;
  top: string;
  width: string;
  height: string;
};

type LeakViolation = {
  surface: string;
  atMs: number;
  sample: string;
};

const MODIFIER_KEY = process.platform === "darwin" ? "Meta" : "Control";

function parseEditorCardId(url: string) {
  const match = url.match(/\/app\/decks\/[^/]+\/edit\/card\/([^/]+)/);
  return match?.[1] ?? null;
}

function parseEditorDeckId(url: string) {
  const match = url.match(/\/app\/decks\/([^/]+)\/edit\/card\/[^/]+/);
  return match?.[1] ?? null;
}

async function waitForNewSidebarCardId(
  page: Parameters<typeof test>[0]["page"],
  previousCardId: string,
) {
  const handle = await page.waitForFunction(
    ({ previousCardId }) => {
      const previews = Array.from(
        document.querySelectorAll<HTMLElement>('[data-testid^="card-sidebar-preview-"]'),
      );
      for (const preview of previews) {
        const testId = preview.getAttribute("data-testid") ?? "";
        const cardId = testId.replace("card-sidebar-preview-", "");
        if (cardId && cardId !== previousCardId) {
          return cardId;
        }
      }
      return null;
    },
    { previousCardId },
    { timeout: 15_000 },
  );

  const value = await handle.jsonValue();
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Card Preview Isolation ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("New-card preview isolation + default text behavior consistency");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

async function replaceQuickEditorText(page: Parameters<typeof test>[0]["page"], text: string) {
  await page.getByTestId("mode-quick-button").click();
  const quickEditor = page.locator('.quick-editor-input-panel [contenteditable="true"]').first();
  await expect(quickEditor).toBeVisible({ timeout: 12000 });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await quickEditor.click({ force: true });
    await page.keyboard.press(`${MODIFIER_KEY}+A`);
    await page.keyboard.press("Backspace");
    await page.keyboard.insertText(text);

    const editorText = (await quickEditor.textContent()) ?? "";
    if (editorText.includes(text)) {
      break;
    }
    await page.waitForTimeout(200);
  }

  await expect
    .poll(async () => ((await quickEditor.textContent()) ?? "").includes(text), { timeout: 12000 })
    .toBeTruthy();
  await expect
    .poll(
      async () =>
        ((await page.getByTestId("quick-live-preview-card").textContent()) ?? "").includes(text),
      { timeout: 12000 },
    )
    .toBeTruthy();
}

function readProjection(locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>) {
  return locator.evaluate((node) =>
    Array.from(node.querySelectorAll(":scope > div.absolute")).map((element) => {
      const wrapper = element as HTMLElement;
      return {
        left: wrapper.style.left,
        top: wrapper.style.top,
        width: wrapper.style.width,
        height: wrapper.style.height,
      };
    }),
  ) as Promise<ProjectionEntry[]>;
}

function parsePx(value: string) {
  return Number.parseFloat(value.replace("px", ""));
}

function getComputedAlign(locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>) {
  return locator.evaluate((node) => window.getComputedStyle(node).textAlign);
}

async function expectCenteredPreviewParagraph(
  locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
) {
  await expect(locator).toBeVisible();
  const paragraph = locator.locator("p").first();
  await expect(paragraph).toBeVisible();
  expect(await getComputedAlign(paragraph)).toBe("center");
}

async function assertNeverContainsToken(
  page: Parameters<typeof test>[0]["page"],
  locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
  token: string,
  samples = 16,
) {
  await expect(locator).toBeVisible();
  for (let index = 0; index < samples; index += 1) {
    const text = (await locator.textContent()) ?? "";
    expect(text).not.toContain(token);
    await page.waitForTimeout(20);
  }
}

async function startPreviewLeakMonitor(
  page: Parameters<typeof test>[0]["page"],
  previousCardId: string,
  token: string,
) {
  await page.evaluate(
    ({ previousCardId, token }) => {
      const win = window as Window & {
        __remoraPreviewLeakMonitor?: {
          stop: () => LeakViolation[];
        };
      };

      if (win.__remoraPreviewLeakMonitor) {
        win.__remoraPreviewLeakMonitor.stop();
      }

      const violations: LeakViolation[] = [];
      const start = performance.now();
      let armed = false;

      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Leak monitor intentionally validates multiple preview surfaces in one pass.
      const check = () => {
        const routeMatch = window.location.pathname.match(
          /\/app\/decks\/[^/]+\/edit\/card\/([^/]+)/,
        );
        const selectedCardId = routeMatch?.[1];
        const sidebarCount = document.querySelectorAll(
          '[data-testid^="card-sidebar-preview-"]',
        ).length;
        if (!armed) {
          if (!selectedCardId || selectedCardId === previousCardId || sidebarCount < 2) {
            return;
          }
          armed = true;
        }

        const elapsed = Math.round(performance.now() - start);

        const quickText = (
          document.querySelector('[data-testid="quick-live-preview-card"]')?.textContent ?? ""
        ).trim();
        if (quickText.includes(token)) {
          violations.push({
            surface: "quick-live-preview",
            atMs: elapsed,
            sample: quickText.slice(0, 200),
          });
        }

        const sideTrayText = (
          document.querySelector('[data-testid="side-tray-item-0"]')?.textContent ?? ""
        ).trim();
        if (sideTrayText.includes(token)) {
          violations.push({
            surface: "bottom-side-tray-active-side",
            atMs: elapsed,
            sample: sideTrayText.slice(0, 200),
          });
        }

        const previews = Array.from(
          document.querySelectorAll<HTMLElement>('[data-testid^="card-sidebar-preview-"]'),
        );
        for (const preview of previews) {
          const testId = preview.getAttribute("data-testid") ?? "";
          const cardId = testId.replace("card-sidebar-preview-", "");
          if (!cardId || cardId === previousCardId) continue;
          const text = (preview.textContent ?? "").trim();
          if (text.includes(token)) {
            violations.push({
              surface: `sidebar-preview-${cardId}`,
              atMs: elapsed,
              sample: text.slice(0, 200),
            });
          }
        }
      };

      const intervalId = window.setInterval(check, 16);
      const observer = new MutationObserver(check);
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
      });

      check();
      win.__remoraPreviewLeakMonitor = {
        stop: () => {
          window.clearInterval(intervalId);
          observer.disconnect();
          return violations;
        },
      };
    },
    { previousCardId, token },
  );
}

function stopPreviewLeakMonitor(page: Parameters<typeof test>[0]["page"]) {
  return page.evaluate(() => {
    const win = window as Window & {
      __remoraPreviewLeakMonitor?: {
        stop: () => LeakViolation[];
      };
    };
    return win.__remoraPreviewLeakMonitor?.stop() ?? [];
  });
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: This suite intentionally keeps end-to-end setup and parity assertions in one flow.
test.describe("New-card preview isolation + default text behavior", () => {
  test("new card creation never leaks previous card text into quick preview, sidebar, or bottom side tray", async ({
    page,
  }) => {
    const previousCardToken = `PREV_${Date.now()}_LEAK_CHECK`;

    await createDeckAndOpenEditor(page);
    const previousCardId = parseEditorCardId(page.url());
    expect(previousCardId).toBeTruthy();
    if (!previousCardId) return;

    await replaceQuickEditorText(page, previousCardToken);
    await expect(page.getByTestId(`card-sidebar-preview-${previousCardId}`)).toContainText(
      previousCardToken,
    );
    await expect(page.getByTestId("side-tray-item-0")).toContainText(previousCardToken);

    await startPreviewLeakMonitor(page, previousCardId, previousCardToken);

    await page.getByText("Section 1").first().click({ button: "right" });
    const contextMenu = page.getByRole("menu", { name: "Sidebar context menu" });
    await expect(contextMenu).toBeVisible();
    await contextMenu.getByRole("button", { name: "New card" }).click();

    const cardPreviews = page.locator('[data-testid^="card-sidebar-preview-"]');
    await expect(cardPreviews).toHaveCount(2);
    const newCardId = await waitForNewSidebarCardId(page, previousCardId);
    expect(newCardId).toBeTruthy();
    expect(newCardId).not.toBe(previousCardId);
    if (!newCardId) return;
    const deckId = parseEditorDeckId(page.url());
    expect(deckId).toBeTruthy();
    if (!deckId) return;
    await page.goto(`/app/decks/${deckId}/edit/card/${newCardId}`);
    await expect(page).toHaveURL(new RegExp(`/app/decks/${deckId}/edit/card/${newCardId}$`));

    const quickPreview = page.getByTestId("quick-live-preview-card");
    const newCardSidebarPreview = page.getByTestId(`card-sidebar-preview-${newCardId}`);
    const activeSideTrayItem = page.getByTestId("side-tray-item-0");
    await expect(activeSideTrayItem).toHaveAttribute("aria-pressed", "true");

    await assertNeverContainsToken(page, quickPreview, previousCardToken, 24);
    await assertNeverContainsToken(page, newCardSidebarPreview, previousCardToken, 24);
    await assertNeverContainsToken(page, activeSideTrayItem, previousCardToken, 24);

    const violations = await stopPreviewLeakMonitor(page);
    expect(violations).toEqual([]);
  });

  test("keeps initial default placement and typing behavior consistent across quick, sidebar, and bottom side tray", async ({
    page,
  }) => {
    const firstLine = `DEFAULT_PLACEMENT_${Date.now()}`;
    const secondLine = "Typing behavior should stay consistent";
    const replacement = `REPLACE_${Date.now()}_TOKEN`;

    await createDeckAndOpenEditor(page);

    const quickEditor = page.locator('.quick-editor-input-panel [contenteditable="true"]').first();
    await expect(quickEditor).toBeVisible();
    await expect
      .poll(async () => ((await quickEditor.textContent()) ?? "").trim(), { timeout: 10000 })
      .toBe("");

    const quickContent = page.getByTestId("quick-live-preview-card-content");
    const sidebarContent = page
      .locator('[data-testid^="card-sidebar-preview-"] > div > div')
      .first();
    const sideTrayContent = page
      .getByTestId("side-tray-item-0")
      .locator(":scope > div > div")
      .first();
    await expect(quickContent).toBeVisible();
    await expect(sidebarContent).toBeVisible();
    await expect(sideTrayContent).toBeVisible();

    const quickProjection = await readProjection(quickContent);
    const sidebarProjection = await readProjection(sidebarContent);
    const sideTrayProjection = await readProjection(sideTrayContent);
    expect(quickProjection.length).toBeGreaterThanOrEqual(1);
    expect(sidebarProjection).toEqual(quickProjection);
    expect(sideTrayProjection).toEqual(quickProjection);

    const firstQuick = quickProjection[0];
    expect(Math.abs(parsePx(firstQuick?.left ?? "0px") - 38)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(parsePx(firstQuick?.top ?? "0px") - 25)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(parsePx(firstQuick?.width ?? "0px") - 684)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(parsePx(firstQuick?.height ?? "0px") - 458)).toBeLessThanOrEqual(0.5);

    await quickEditor.click();
    await page.keyboard.type(firstLine);
    await page.keyboard.press("Enter");
    await page.keyboard.type(secondLine);

    const quickRichText = page
      .locator('[data-testid^="quick-live-preview-card-richtext-"]')
      .first();
    const sidebarRichText = page
      .locator('[data-testid^="card-sidebar-preview-"] .remora-preview-scroll')
      .first();
    const sideTrayRichText = page
      .getByTestId("side-tray-item-0")
      .locator(".remora-preview-scroll")
      .first();

    await expect(quickRichText).toContainText(firstLine);
    await expect(quickRichText).toContainText(secondLine);
    await expect(sidebarRichText).toContainText(firstLine);
    await expect(sidebarRichText).toContainText(secondLine);
    await expect(sideTrayRichText).toContainText(firstLine);
    await expect(sideTrayRichText).toContainText(secondLine);

    const quickEditorParagraph = page
      .locator('.quick-editor-input-panel [contenteditable="true"] p')
      .first();
    expect(await getComputedAlign(quickEditorParagraph)).toBe("center");
    await expectCenteredPreviewParagraph(quickRichText);
    await expectCenteredPreviewParagraph(sidebarRichText);
    await expectCenteredPreviewParagraph(sideTrayRichText);

    await quickEditor.click({ force: true });
    await page.keyboard.press(`${MODIFIER_KEY}+A`);
    await page.getByRole("button", { name: "Text alignment" }).first().click({ force: true });
    await page.getByRole("menuitem", { name: "Center" }).click();
    await page.waitForTimeout(120);

    const quickPreviewParagraph = page
      .locator('[data-testid^="quick-live-preview-card-richtext-"] p')
      .first();
    const sidebarPreviewParagraph = page
      .locator('[data-testid^="card-sidebar-preview-"] .remora-richtext-content p')
      .first();
    const sideTrayPreviewParagraph = page
      .getByTestId("side-tray-item-0")
      .locator(".remora-richtext-content p")
      .first();

    expect(await getComputedAlign(quickEditorParagraph)).toBe("center");
    expect(await getComputedAlign(quickPreviewParagraph)).toBe("center");
    expect(await getComputedAlign(sidebarPreviewParagraph)).toBe("center");
    expect(await getComputedAlign(sideTrayPreviewParagraph)).toBe("center");

    await quickEditor.click({ force: true });
    await page.keyboard.press(`${MODIFIER_KEY}+A`);
    await page.keyboard.press("Backspace");
    await page.keyboard.insertText(replacement);

    await expect(quickRichText).toContainText(replacement);
    await expect(sidebarRichText).toContainText(replacement);
    await expect(sideTrayRichText).toContainText(replacement);

    await expect(quickRichText).not.toContainText(firstLine);
    await expect(sidebarRichText).not.toContainText(firstLine);
    await expect(sideTrayRichText).not.toContainText(firstLine);
  });
});

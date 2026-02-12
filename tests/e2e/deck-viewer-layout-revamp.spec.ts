import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

function parseEditUrl(url: string) {
  const match = url.match(/\/app\/decks\/([^/]+)\/edit\/card\/([^/]+)/);
  if (!match) {
    throw new Error(`Unexpected edit URL format: ${url}`);
  }
  return { deckId: match[1], cardId: match[2] };
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

async function createNewCardFromSectionMenu(page: Parameters<typeof test>[0]["page"]) {
  await page.getByText("Section 1").first().click({ button: "right" });
  const contextMenu = page.getByRole("menu", { name: "Sidebar context menu" });
  await expect(contextMenu).toBeVisible();
  await contextMenu.getByRole("button", { name: "New card" }).click();
}

async function ensureSideCount(page: Parameters<typeof test>[0]["page"], expectedCount: number) {
  const sideLocator = page.locator('[data-testid^="side-tray-item-"]');
  const persistRetryButton = page.getByRole("button", { name: "Retry" }).first();
  const addSideButton = page.getByTestId("side-tray-add-side");

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const currentCount = await sideLocator.count();
    if (currentCount >= expectedCount) {
      return;
    }

    if (await persistRetryButton.isVisible().catch(() => false)) {
      await persistRetryButton.click();
    }

    await addSideButton.click({ force: true });
    try {
      await expect
        .poll(async () => sideLocator.count(), { timeout: 7000 })
        .toBeGreaterThan(currentCount);
    } catch {
      // Retry add-side clicks; persistence can be delayed.
    }
  }

  await expect.poll(async () => sideLocator.count(), { timeout: 20000 }).toBe(expectedCount);
}

async function createViewerFixture(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  const signInRequired = page.getByText("Sign in required", { exact: true });
  if (await signInRequired.isVisible().catch(() => false)) {
    await signInAsOwner(page);
    await page.goto("/app/decks/new");
  }
  await expect(page.getByTestId("newdeck-hydrated")).toHaveText("yes");

  const title = `Viewer Revamp Deck ${Date.now()}`;
  await page.getByPlaceholder("Biology Midterm").fill(title);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Viewer layout revamp regression.");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);

  const first = parseEditUrl(page.url());
  const previousCardId = first.cardId;
  await createNewCardFromSectionMenu(page);
  const secondCardId = await waitForNewSidebarCardId(page, previousCardId);
  expect(secondCardId).toBeTruthy();
  if (!secondCardId) {
    throw new Error("Expected a newly created card in sidebar previews.");
  }
  await page.getByTestId(`card-sidebar-preview-${secondCardId}`).click();
  await page.goto(`/app/decks/${first.deckId}/edit/card/${secondCardId}`);
  await expect(page).toHaveURL(new RegExp(`/app/decks/${first.deckId}/edit/card/${secondCardId}$`));

  await page.getByTestId("mode-quick-button").click();
  await ensureSideCount(page, 3);
  await expect(page.getByTestId("side-tray-item-2")).toBeVisible({ timeout: 20000 });

  const retryButton = page.getByRole("button", { name: "Retry" }).first();
  if (await retryButton.isVisible().catch(() => false)) {
    await retryButton.click();
  }

  return {
    deckId: first.deckId,
    cardTwoSide: first.cardId,
    cardThreeSide: secondCardId,
  };
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function isWithinViewport(
  box: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number },
) {
  return (
    box.x >= -1 &&
    box.y >= -1 &&
    box.x + box.width <= viewport.width + 1 &&
    box.y + box.height <= viewport.height + 1
  );
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Viewer revamp coverage intentionally validates URL sync, card transitions, and responsive layout in one suite.
test.describe("Deck viewer revamp", () => {
  test("renders read-only insight-style sidebar and card selection updates URL", async ({
    page,
  }) => {
    const fixture = await createViewerFixture(page);
    await page.goto(`/deck/${fixture.deckId}`);

    await expect(page).toHaveURL(new RegExp(`/deck/${fixture.deckId}/card/[^/]+$`));
    await expect(page.getByTestId("viewer-sidebar")).toBeVisible();
    await expect
      .poll(async () => page.locator('[data-testid^="viewer-section-"]').count(), {
        timeout: 10000,
      })
      .toBeGreaterThan(0);
    await expect(page.locator('[data-testid^="viewer-card-item-"]')).toHaveCount(2);
    await expect(page.getByTestId("side-tray-add-side")).toHaveCount(0);

    await page.getByTestId(`viewer-card-item-${fixture.cardThreeSide}`).click();
    await expect(page).toHaveURL(
      new RegExp(`/deck/${fixture.deckId}/card/${fixture.cardThreeSide}$`),
    );
    await expect(page.getByTestId("viewer-side-dot-0")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-testid^="viewer-side-dot-"]')).toHaveCount(3);
  });

  test("uses flip animation only for 2-side cards and instant switching for 3+ sides", async ({
    page,
  }) => {
    const fixture = await createViewerFixture(page);

    await page.goto(`/deck/${fixture.deckId}/card/${fixture.cardTwoSide}`);
    await page.getByTestId(`viewer-card-item-${fixture.cardTwoSide}`).click();
    await expect(page).toHaveURL(
      new RegExp(`/deck/${fixture.deckId}/card/${fixture.cardTwoSide}$`),
    );
    await expect(page.locator('[data-testid^="viewer-side-dot-"]')).toHaveCount(2);
    await expect(page.getByTestId("viewer-main-card-flip-shell")).toBeVisible();
    await expect(page.getByTestId("viewer-main-card-face-front")).toBeVisible();
    await expect(page.getByTestId("viewer-main-card-face-back")).toBeVisible();
    await expect(page.getByTestId("viewer-side-dot-0")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".deck-viewer-flip-inner")).not.toHaveClass(/is-flipped/);

    await page.getByTestId("viewer-main-card").click();
    await expect(page.getByTestId("viewer-side-dot-1")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".deck-viewer-flip-inner")).toHaveClass(/is-flipped/);

    await page.getByTestId(`viewer-card-item-${fixture.cardThreeSide}`).click();
    await expect(page).toHaveURL(
      new RegExp(`/deck/${fixture.deckId}/card/${fixture.cardThreeSide}$`),
    );
    await expect(page.getByTestId("viewer-main-card-flip-shell")).toHaveCount(0);
    await expect(page.getByTestId("viewer-side-dot-0")).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("viewer-main-card").click();
    await expect(page.getByTestId("viewer-side-dot-1")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("viewer-main-card").click();
    await expect(page.getByTestId("viewer-side-dot-2")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("viewer-main-card").click();
    await expect(page.getByTestId("viewer-side-dot-0")).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("viewer-main-card").click();
    await expect(page.getByTestId("viewer-side-dot-1")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId(`viewer-card-item-${fixture.cardTwoSide}`).click();
    await expect(page).toHaveURL(
      new RegExp(`/deck/${fixture.deckId}/card/${fixture.cardTwoSide}$`),
    );
    await expect(page.getByTestId("viewer-side-dot-0")).toHaveAttribute("aria-pressed", "true");
  });

  test("supports prev/next boundaries and remains non-overlapping across viewport sizes", async ({
    page,
  }) => {
    const fixture = await createViewerFixture(page);
    await page.goto(`/deck/${fixture.deckId}/card/${fixture.cardTwoSide}`);

    const prevButton = page.getByTestId("viewer-prev-card");
    const nextButton = page.getByTestId("viewer-next-card");
    const initialUrl = page.url();
    const counterLocator = page.getByTestId("viewer-card-counter");
    const parseCounter = async () => {
      const text = (await counterLocator.textContent())?.trim() ?? "";
      const [ordinalText, totalText] = text.split("/").map((segment) => segment.trim());
      const ordinal = Number(ordinalText);
      const total = Number(totalText);
      if (Number.isNaN(ordinal) || Number.isNaN(total)) {
        throw new Error(`Unexpected viewer counter format: ${text}`);
      }
      return { ordinal, total };
    };

    const prevEnabled = await prevButton.isEnabled();
    const nextEnabled = await nextButton.isEnabled();
    expect(prevEnabled || nextEnabled).toBeTruthy();
    expect(prevEnabled && nextEnabled).toBeFalsy();

    const beforeCounter = await parseCounter();
    const navDirection = nextEnabled ? 1 : -1;
    const buttonToClick = navDirection === 1 ? nextButton : prevButton;
    await buttonToClick.click();

    await expect.poll(() => page.url(), { timeout: 8000 }).not.toBe(initialUrl);

    const expectedOrdinal = beforeCounter.ordinal + navDirection;
    expect(expectedOrdinal).toBeGreaterThanOrEqual(1);
    expect(expectedOrdinal).toBeLessThanOrEqual(beforeCounter.total);
    await expect(counterLocator).toHaveText(`${expectedOrdinal} / ${beforeCounter.total}`);

    const movedPrevEnabled = await prevButton.isEnabled();
    const movedNextEnabled = await nextButton.isEnabled();
    expect(movedPrevEnabled || movedNextEnabled).toBeTruthy();
    expect(movedPrevEnabled && movedNextEnabled).toBeFalsy();

    const viewports = [
      { width: 1536, height: 960 },
      { width: 1280, height: 820 },
      { width: 1100, height: 720 },
      { width: 980, height: 680 },
      { width: 820, height: 780 },
      { width: 820, height: 900 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.locator(".deck-viewer-main-scroll").evaluate((node) => {
        node.scrollTop = 0;
      });
      await expect(page.getByTestId("viewer-sidebar")).toBeVisible();
      await expect(page.getByTestId("viewer-main-card")).toBeVisible();
      await expect(page.getByTestId("viewer-side-dots")).toBeVisible();
      await expect(page.locator(".deck-viewer-nav-row")).toBeVisible();

      const sidebar = await page.getByTestId("viewer-sidebar").boundingBox();
      const mainCard = await page.getByTestId("viewer-main-card").boundingBox();
      const sideDots = await page.getByTestId("viewer-side-dots").boundingBox();
      const navRow = await page.locator(".deck-viewer-nav-row").boundingBox();
      expect(sidebar).not.toBeNull();
      expect(mainCard).not.toBeNull();
      expect(sideDots).not.toBeNull();
      expect(navRow).not.toBeNull();
      if (!sidebar || !mainCard || !sideDots || !navRow) continue;

      expect(boxesOverlap(sidebar, mainCard)).toBeFalsy();
      expect(isWithinViewport(mainCard, viewport)).toBeTruthy();
      expect(isWithinViewport(sideDots, viewport)).toBeTruthy();
      expect(isWithinViewport(navRow, viewport)).toBeTruthy();
    }
  });
});

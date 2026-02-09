import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

function parseEditUrl(url: string) {
  const match = url.match(/\/app\/decks\/([^/]+)\/edit\/card\/([^/]+)/);
  if (!match) {
    throw new Error(`Unexpected edit URL format: ${url}`);
  }
  return { deckId: match[1], cardId: match[2] };
}

async function fillPrimaryRichText(page: Parameters<typeof test>[0]["page"], value: string) {
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(value);
}

async function createViewerFixture(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await expect(page.getByTestId("newdeck-hydrated")).toHaveText("yes");

  const title = `Viewer Revamp Deck ${Date.now()}`;
  await page.getByPlaceholder("Biology Midterm").fill(title);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Viewer layout revamp regression.");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);

  const first = parseEditUrl(page.url());
  const sideOneToken = `two-side front ${Date.now()}`;
  const sideTwoToken = `two-side back ${Date.now()}`;
  const threeSideToken = `three-side side-three ${Date.now()}`;
  const secondCardFrontToken = `three-side front ${Date.now()}`;

  await page.getByTestId("mode-quick-button").click();
  await fillPrimaryRichText(page, sideOneToken);
  await page.getByTestId("side-tray-item-1").click();
  await fillPrimaryRichText(page, sideTwoToken);

  const previousUrl = page.url();
  await page.getByRole("button", { name: "Section" }).click();
  await expect.poll(() => page.url(), { timeout: 15000 }).not.toBe(previousUrl);
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
  const second = parseEditUrl(page.url());

  await page.getByTestId("mode-quick-button").click();
  await fillPrimaryRichText(page, secondCardFrontToken);
  await page.getByTestId("side-tray-add-side").click();
  await expect(page.getByTestId("side-tray-item-2")).toBeVisible();
  await page.getByTestId("side-tray-item-2").click();
  await fillPrimaryRichText(page, threeSideToken);

  await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

  return {
    deckId: first.deckId,
    cardTwoSide: first.cardId,
    cardThreeSide: second.cardId,
    sideOneToken,
    sideTwoToken,
    secondCardFrontToken,
    threeSideToken,
  };
}

function boxesOverlap(a: { x: number; y: number; width: number; height: number }, b: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

test.describe("Deck viewer revamp", () => {
  test("renders read-only insight-style sidebar and card selection updates URL", async ({ page }) => {
    const fixture = await createViewerFixture(page);
    await page.goto(`/deck/${fixture.deckId}`);

    await expect(page).toHaveURL(new RegExp(`/deck/${fixture.deckId}/card/[^/]+$`));
    await expect(page.getByTestId("viewer-sidebar")).toBeVisible();
    await expect(page.locator('[data-testid^="viewer-section-"]')).toHaveCount(2);
    await expect(page.getByTestId("side-tray-add-side")).toHaveCount(0);

    await page.getByTestId(`viewer-card-item-${fixture.cardThreeSide}`).click();
    await expect(page).toHaveURL(new RegExp(`/deck/${fixture.deckId}/card/${fixture.cardThreeSide}$`));
    await expect(page.getByTestId("viewer-main-card")).toContainText(fixture.secondCardFrontToken);
  });

  test("uses flip animation only for 2-side cards and instant switching for 3+ sides", async ({ page }) => {
    const fixture = await createViewerFixture(page);

    await page.goto(`/deck/${fixture.deckId}/card/${fixture.cardTwoSide}`);
    await expect(page.getByTestId("viewer-main-card-flip-shell")).toBeVisible();
    await expect(page.getByTestId("viewer-main-card-face-front")).toBeVisible();
    await expect(page.getByTestId("viewer-main-card-face-back")).toBeVisible();
    await expect(page.getByTestId("viewer-card-counter")).toContainText("Side 1 / 2");

    await page.getByTestId("viewer-main-card").click();
    await expect(page.getByTestId("viewer-card-counter")).toContainText("Side 2 / 2");
    await expect(page.getByTestId("viewer-main-card")).toContainText(fixture.sideTwoToken);

    await page.getByTestId("viewer-next-card").click();
    await expect(page).toHaveURL(new RegExp(`/deck/${fixture.deckId}/card/${fixture.cardThreeSide}$`));
    await expect(page.getByTestId("viewer-main-card-flip-shell")).toHaveCount(0);
    await expect(page.getByTestId("viewer-card-counter")).toContainText("Side 1 / 3");

    await page.getByTestId("viewer-main-card").click();
    await expect(page.getByTestId("viewer-card-counter")).toContainText("Side 2 / 3");
    await page.getByTestId("viewer-main-card").click();
    await expect(page.getByTestId("viewer-card-counter")).toContainText("Side 3 / 3");
    await page.getByTestId("viewer-main-card").click();
    await expect(page.getByTestId("viewer-card-counter")).toContainText("Side 1 / 3");

    await page.getByTestId("viewer-main-card").click();
    await expect(page.getByTestId("viewer-card-counter")).toContainText("Side 2 / 3");
    await page.getByTestId("viewer-prev-card").click();
    await expect(page).toHaveURL(new RegExp(`/deck/${fixture.deckId}/card/${fixture.cardTwoSide}$`));
    await expect(page.getByTestId("viewer-card-counter")).toContainText("Side 1 / 2");
  });

  test("supports prev/next boundaries and remains non-overlapping across viewport sizes", async ({ page }) => {
    const fixture = await createViewerFixture(page);
    await page.goto(`/deck/${fixture.deckId}/card/${fixture.cardTwoSide}`);

    await expect(page.getByTestId("viewer-prev-card")).toBeDisabled();
    await expect(page.getByTestId("viewer-next-card")).toBeEnabled();
    await page.getByTestId("viewer-next-card").click();
    await expect(page).toHaveURL(new RegExp(`/deck/${fixture.deckId}/card/${fixture.cardThreeSide}$`));
    await expect(page.getByTestId("viewer-card-counter")).toContainText("Card 2 / 2");
    await expect(page.getByTestId("viewer-next-card")).toBeDisabled();
    await expect(page.getByTestId("viewer-prev-card")).toBeEnabled();

    await page.getByTestId("viewer-prev-card").click();
    await expect(page).toHaveURL(new RegExp(`/deck/${fixture.deckId}/card/${fixture.cardTwoSide}$`));

    const viewports = [
      { width: 1536, height: 960 },
      { width: 1100, height: 820 },
      { width: 820, height: 1180 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expect(page.getByTestId("viewer-sidebar")).toBeVisible();
      await expect(page.getByTestId("viewer-main-card")).toBeVisible();

      const sidebar = await page.getByTestId("viewer-sidebar").boundingBox();
      const mainCard = await page.getByTestId("viewer-main-card").boundingBox();
      expect(sidebar).not.toBeNull();
      expect(mainCard).not.toBeNull();
      if (!sidebar || !mainCard) continue;

      expect(boxesOverlap(sidebar, mainCard)).toBeFalsy();
    }
  });
});

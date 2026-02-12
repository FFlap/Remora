import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

type Rect = { top: number; right: number; bottom: number; left: number };

type VisibilityMetrics = {
  viewport: { width: number; height: number };
  cardRect: Rect | null;
  containerRect: Rect | null;
  cardFullyVisible: boolean;
  containerScrollableY: boolean;
  containerScrollableX: boolean;
  topVisibleAtStart: boolean;
  bottomVisibleAtEnd: boolean;
  leftVisibleAtStart: boolean;
  rightVisibleAtEnd: boolean;
};

type Viewport = { width: number; height: number };

const HALF_HEIGHT_VIEWPORTS: Viewport[] = [
  { width: 1905, height: 845 },
  { width: 1248, height: 896 },
  { width: 1536, height: 560 },
  { width: 1280, height: 640 },
  { width: 980, height: 560 },
];

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Half Height Deck ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Half-height editor visibility and scroll behavior");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

function readVisibilityMetrics(
  page: Parameters<typeof test>[0]["page"],
  selectors: { container: string; card: string },
): Promise<VisibilityMetrics | null> {
  return page.evaluate(
    ({ containerSelector, cardSelector }) => {
      const container = document.querySelector(containerSelector) as HTMLElement | null;
      const card = document.querySelector(cardSelector) as HTMLElement | null;
      if (!container || !card) return null;

      const containerRect = container.getBoundingClientRect();
      const within = (cardRect: DOMRect) =>
        cardRect.top >= containerRect.top - 1 &&
        cardRect.left >= containerRect.left - 1 &&
        cardRect.bottom <= containerRect.bottom + 1 &&
        cardRect.right <= containerRect.right + 1;

      container.scrollTop = 0;
      container.scrollLeft = 0;
      const atStartRect = card.getBoundingClientRect();

      const maxScrollY = Math.max(0, container.scrollHeight - container.clientHeight);
      const maxScrollX = Math.max(0, container.scrollWidth - container.clientWidth);

      container.scrollTop = maxScrollY;
      const atBottomRect = card.getBoundingClientRect();

      container.scrollLeft = maxScrollX;
      const atEndRect = card.getBoundingClientRect();

      const cardFullyVisible = within(atStartRect);
      const topVisibleAtStart = atStartRect.top >= containerRect.top - 1;
      const leftVisibleAtStart = atStartRect.left >= containerRect.left - 1;
      const bottomVisibleAtEnd = atBottomRect.bottom <= containerRect.bottom + 1;
      const rightVisibleAtEnd = atEndRect.right <= containerRect.right + 1;

      container.scrollTop = 0;
      container.scrollLeft = 0;

      return {
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        cardRect: {
          top: atStartRect.top,
          right: atStartRect.right,
          bottom: atStartRect.bottom,
          left: atStartRect.left,
        },
        containerRect: {
          top: containerRect.top,
          right: containerRect.right,
          bottom: containerRect.bottom,
          left: containerRect.left,
        },
        cardFullyVisible,
        containerScrollableY: container.scrollHeight > container.clientHeight + 1,
        containerScrollableX: container.scrollWidth > container.clientWidth + 1,
        topVisibleAtStart,
        bottomVisibleAtEnd,
        leftVisibleAtStart,
        rightVisibleAtEnd,
      };
    },
    { containerSelector: selectors.container, cardSelector: selectors.card },
  );
}

test.describe("Half-height editor visibility and scroll", () => {
  test("quick mode keeps full preview card visible or makes it reachable via scroll", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);
    await page.getByTestId("mode-quick-button").click();
    await expect(page.getByTestId("quick-live-preview-card")).toBeVisible();

    for (const viewport of HALF_HEIGHT_VIEWPORTS) {
      await page.setViewportSize(viewport);
      await expect(page.getByTestId("quick-live-preview-card")).toBeVisible();

      const metrics = await readVisibilityMetrics(page, {
        container: '[data-testid="editor-content-row"]',
        card: '[data-testid="quick-live-preview-card"]',
      });
      expect(metrics).not.toBeNull();
      if (!metrics) continue;

      const verticallyInspectable = metrics.topVisibleAtStart && metrics.bottomVisibleAtEnd;
      const horizontallyInspectable = metrics.leftVisibleAtStart && metrics.rightVisibleAtEnd;
      expect(
        metrics.cardFullyVisible || (verticallyInspectable && horizontallyInspectable),
      ).toBeTruthy();
    }
  });

  test("creative mode keeps full canvas visible or makes it reachable via scroll", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);
    await page.getByTestId("mode-creative-button").click();
    await expect(page.getByTestId("creative-card-canvas")).toBeVisible();

    for (const viewport of HALF_HEIGHT_VIEWPORTS) {
      await page.setViewportSize(viewport);
      await expect(page.getByTestId("creative-card-canvas")).toBeVisible();

      const metrics = await readVisibilityMetrics(page, {
        container: '[data-testid="creative-stage-viewport"]',
        card: '[data-testid="creative-card-canvas"]',
      });
      expect(metrics).not.toBeNull();
      if (!metrics) continue;

      const verticallyInspectable = metrics.topVisibleAtStart && metrics.bottomVisibleAtEnd;
      const horizontallyInspectable = metrics.leftVisibleAtStart && metrics.rightVisibleAtEnd;
      expect(
        metrics.cardFullyVisible || (verticallyInspectable && horizontallyInspectable),
      ).toBeTruthy();
    }
  });
});

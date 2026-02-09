import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";
import { CONSISTENCY_LONG_TEXT } from "./utils/longTextFixture";

type ProjectionEntry = {
  left: string;
  top: string;
  width: string;
  height: string;
  transform: string;
  textContent: string;
};

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Preview Longtext Consistency ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Parity checks for sidebar/quick/creative previews");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

function readProjection(locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>): Promise<ProjectionEntry[]> {
  return locator.evaluate((node) =>
    Array.from(node.querySelectorAll(":scope > div.absolute")).map((element) => {
      const wrapper = element as HTMLElement;
      return {
        left: wrapper.style.left,
        top: wrapper.style.top,
        width: wrapper.style.width,
        height: wrapper.style.height,
        transform: wrapper.style.transform,
        textContent: wrapper.innerText.replace(/\s+/g, " ").trim(),
      };
    }),
  );
}

function readCreativeProjection(
  locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
): Promise<ProjectionEntry[]> {
  return locator.evaluate((node) =>
    Array.from(node.querySelectorAll('[data-testid^="creative-richtext-static-"]')).map((element) => {
      const wrapper = element as HTMLElement;
      return {
        left: wrapper.style.left,
        top: wrapper.style.top,
        width: wrapper.style.width,
        height: wrapper.style.height,
        transform: wrapper.style.transform,
        textContent: wrapper.innerText.replace(/\s+/g, " ").trim(),
      };
    }),
  );
}

async function verifyOverflowScroll(
  richTextLocator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
): Promise<void> {
  const overflow = await richTextLocator.evaluate((node) => node.scrollHeight > node.clientHeight + 1);
  expect(overflow).toBeTruthy();
  const delta = await richTextLocator.evaluate((node) => {
    const before = node.scrollTop;
    node.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: 720,
        bubbles: true,
        cancelable: true,
      }),
    );
    return node.scrollTop - before;
  });
  expect(delta).toBeGreaterThan(0);
}

async function prepareLongText(page: Parameters<typeof test>[0]["page"], expectedSnippet: string) {
  const quickEditor = page.locator('[contenteditable="true"]').first();
  await quickEditor.click();
  await quickEditor.fill(CONSISTENCY_LONG_TEXT);
  await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 20000 });

  const quickContent = page.getByTestId("quick-live-preview-card-content");
  const quickRichText = page.locator('[data-testid^="quick-live-preview-card-richtext-"]').first();
  const sidebarPreviewRoot = page.locator('[data-testid^="card-sidebar-preview-"] > div').first();
  const sidebarContent = sidebarPreviewRoot.locator(":scope > div").first();
  const sidebarRichText = sidebarContent.locator(":scope > div.absolute > div").first();

  await expect(quickContent).toBeVisible();
  await expect(sidebarContent).toBeVisible();
  await expect(quickRichText).toContainText(expectedSnippet);
  await expect(sidebarRichText).toContainText(expectedSnippet);

  return { quickContent, quickRichText, sidebarContent, sidebarRichText };
}

async function verifyQuickAndSidebarParity(
  quickContent: ReturnType<Parameters<typeof test>[0]["page"]["getByTestId"]>,
  quickRichText: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
  sidebarContent: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
  sidebarRichText: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
) {
  await verifyOverflowScroll(quickRichText);
  await verifyOverflowScroll(sidebarRichText);

  await quickRichText.evaluate((node) => {
    node.scrollTop = 0;
  });
  await sidebarRichText.evaluate((node) => {
    node.scrollTop = 0;
  });

  const quickProjection = await readProjection(quickContent);
  const sidebarProjection = await readProjection(sidebarContent);
  expect(sidebarProjection).toEqual(quickProjection);
  return quickProjection;
}

async function verifyCreativeParity(
  page: Parameters<typeof test>[0]["page"],
  expectedSnippet: string,
  quickProjection: ProjectionEntry[],
) {
  await page.getByTestId("mode-creative-button").click();
  const creativeShellContent = page.getByTestId("creative-card-shell").locator(":scope > div").first();
  await expect(creativeShellContent).toBeVisible();

  const creativeRichTexts = page.locator(
    '[data-testid^="creative-richtext-static-"]:not([data-testid="creative-richtext-static-layer"])',
  );
  await expect(creativeRichTexts.first()).toContainText(expectedSnippet);
  expect(await creativeRichTexts.count()).toBeGreaterThan(0);

  const creativeOverflowCount = await creativeRichTexts.evaluateAll((nodes) =>
    nodes.filter((node) => node.scrollHeight > node.clientHeight + 1).length,
  );
  if (creativeOverflowCount > 0) {
    const creativeScrollDelta = await creativeRichTexts.evaluateAll((nodes) => {
      const firstOverflow = nodes.find((node) => node.scrollHeight > node.clientHeight + 1);
      if (!firstOverflow) return 0;
      const before = firstOverflow.scrollTop;
      firstOverflow.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: 720,
          bubbles: true,
          cancelable: true,
        }),
      );
      return firstOverflow.scrollTop - before;
    });
    expect(creativeScrollDelta).toBeGreaterThan(0);
  }

  const creativeProjection = await readCreativeProjection(creativeShellContent);
  const quickTextProjection = quickProjection.filter((entry) => entry.textContent.length > 0);
  const creativeTextProjection = creativeProjection.filter((entry) => entry.textContent.length > 0);
  expect(creativeTextProjection.length).toBeGreaterThan(0);
  expect(creativeTextProjection[0]?.textContent).toContain(expectedSnippet);
  expect(quickTextProjection[0]?.textContent).toContain(expectedSnippet);
}

test.describe("Long text preview consistency", () => {
  test("keeps sidebar, quick, and creative preview rendering aligned with overflow scrolling", async ({ page }) => {
    await createDeckAndOpenEditor(page);
    const expectedSnippet = CONSISTENCY_LONG_TEXT.slice(0, 24);
    const { quickContent, quickRichText, sidebarContent, sidebarRichText } = await prepareLongText(page, expectedSnippet);
    const quickProjection = await verifyQuickAndSidebarParity(
      quickContent,
      quickRichText,
      sidebarContent,
      sidebarRichText,
    );
    await verifyCreativeParity(page, expectedSnippet, quickProjection);
  });
});

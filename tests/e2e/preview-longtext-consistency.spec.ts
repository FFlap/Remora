import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";
import { CONSISTENCY_LONG_TEXT } from "./utils/longTextFixture";

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

test.describe("Long text preview consistency", () => {
  test("keeps sidebar, quick, and creative preview rendering aligned with overflow scrolling", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);

    const quickEditor = page.locator('[contenteditable="true"]').first();
    await quickEditor.click();
    await quickEditor.fill(CONSISTENCY_LONG_TEXT);
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 20000 });
    const expectedSnippet = CONSISTENCY_LONG_TEXT.slice(0, 24);

    const quickContent = page.getByTestId("quick-live-preview-card-content");
    await expect(quickContent).toBeVisible();
    const quickRichText = page.locator('[data-testid^="quick-live-preview-card-richtext-"]').first();
    await expect(quickRichText).toContainText(expectedSnippet);

    const sidebarPreviewRoot = page.locator('[data-testid^="card-sidebar-preview-"] > div').first();
    await expect(sidebarPreviewRoot).toBeVisible();
    const sidebarContent = sidebarPreviewRoot.locator(":scope > div").first();
    await expect(sidebarContent).toBeVisible();
    const sidebarRichText = sidebarContent.locator(":scope > div.absolute > div").first();
    await expect(sidebarRichText).toContainText(expectedSnippet);

    const quickOverflow = await quickRichText.evaluate((node) => node.scrollHeight > node.clientHeight + 1);
    const sidebarOverflow = await sidebarRichText.evaluate((node) => node.scrollHeight > node.clientHeight + 1);
    expect(quickOverflow).toBeTruthy();
    expect(sidebarOverflow).toBeTruthy();

    const quickScrollDelta = await quickRichText.evaluate((node) => {
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
    expect(quickScrollDelta).toBeGreaterThan(0);

    const sidebarScrollDelta = await sidebarRichText.evaluate((node) => {
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
    expect(sidebarScrollDelta).toBeGreaterThan(0);

    // Reset to baseline before visual parity capture so scroll positions don't skew diffs.
    await quickRichText.evaluate((node) => {
      node.scrollTop = 0;
    });
    await sidebarRichText.evaluate((node) => {
      node.scrollTop = 0;
    });

    const quickProjection = await quickContent.evaluate((node) =>
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
    const sidebarProjection = await sidebarContent.evaluate((node) =>
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
    expect(sidebarProjection).toEqual(quickProjection);

    await page.getByTestId("mode-creative-button").click();
    const creativeShellContent = page.getByTestId("creative-card-shell").locator(":scope > div").first();
    await expect(creativeShellContent).toBeVisible();
    const creativeRichTexts = page.locator(
      '[data-testid^="creative-richtext-static-"]:not([data-testid="creative-richtext-static-layer"])',
    );
    await expect(creativeRichTexts.first()).toContainText(expectedSnippet);
    const creativeNodeCount = await creativeRichTexts.count();
    expect(creativeNodeCount).toBeGreaterThan(0);

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

    const creativeProjection = await creativeShellContent.evaluate((node) =>
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
    const quickTextProjection = quickProjection.filter((entry) => entry.textContent.length > 0);
    const creativeTextProjection = creativeProjection.filter((entry) => entry.textContent.length > 0);
    expect(creativeTextProjection.length).toBeGreaterThan(0);
    expect(creativeTextProjection[0]?.textContent).toContain(expectedSnippet);
    expect(quickTextProjection[0]?.textContent).toContain(expectedSnippet);
  });
});

import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

type PreviewProjection = Array<{
  textContent: string;
  left: string;
  top: string;
  width: string;
  height: string;
  transform: string;
}>;

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Sidebar Parity Deck ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Sidebar vs quick preview projection parity");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

function getProjection(locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>) {
  return locator.evaluate((node) => {
    const wrappers = Array.from(node.querySelectorAll(":scope > div.absolute"));
    return wrappers.map((element) => {
      const wrapper = element as HTMLElement;
      const style = window.getComputedStyle(wrapper);
      const wrapperRect = wrapper.getBoundingClientRect();
      const hostRect = (node as HTMLElement).getBoundingClientRect();
      const leftFallback = `${wrapperRect.left - hostRect.left}px`;
      const topFallback = `${wrapperRect.top - hostRect.top}px`;
      const widthFallback = `${wrapperRect.width}px`;
      const heightFallback = `${wrapperRect.height}px`;
      const transformFallback = style.transform === "none" ? "" : style.transform;
      return {
        textContent: wrapper.innerText.replace(/\s+/g, " ").trim(),
        left: wrapper.style.left || style.left || leftFallback,
        top: wrapper.style.top || style.top || topFallback,
        width: wrapper.style.width || style.width || widthFallback,
        height: wrapper.style.height || style.height || heightFallback,
        transform: wrapper.style.transform || transformFallback,
      };
    });
  }) as Promise<PreviewProjection>;
}

test.describe("Sidebar preview projection parity", () => {
  test("uses the same element projection in quick preview and sidebar preview", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);

    const quickEditor = page.locator('[contenteditable="true"]').first();
    await quickEditor.click();
    await page.keyboard.type("Projection parity token.");
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId("mode-creative-button").click();
    const creativeCanvas = page.getByTestId("creative-card-canvas");
    await expect(creativeCanvas).toBeVisible();
    const canvasBox = await creativeCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) return;

    await page.getByTestId("creative-tool-draw").click();
    await page.mouse.move(canvasBox.x + 80, canvasBox.y + 120);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 360, canvasBox.y + 210, { steps: 20 });
    await page.mouse.up();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId("mode-quick-button").click();
    const quickContent = page.getByTestId("quick-live-preview-card-content");
    await expect(quickContent).toBeVisible();

    const sidebarPreviewRoot = page.locator('[data-testid^="card-sidebar-preview-"] > div').first();
    await expect(sidebarPreviewRoot).toBeVisible();
    const sidebarContent = sidebarPreviewRoot.locator(":scope > div").first();
    await expect(sidebarContent).toBeVisible();

    const quickProjection = await getProjection(quickContent);
    const sidebarProjection = await getProjection(sidebarContent);

    expect(sidebarProjection).toEqual(quickProjection);
  });
});

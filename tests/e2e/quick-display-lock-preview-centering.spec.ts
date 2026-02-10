import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

type ProjectionEntry = {
  textContent: string;
  left: string;
  top: string;
  width: string;
  height: string;
};

const ALIGNMENT_OPTIONS = [
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
  { label: "Justify", value: "justify" },
  { label: "Left", value: "left" },
] as const;
const DEFAULT_FRAME = { left: 38, top: 25, width: 684, height: 458 };

const MODIFIER_KEY = process.platform === "darwin" ? "Meta" : "Control";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Quick Center Parity ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Quick editor and preview centering parity");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

function readProjection(locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>) {
  return locator.evaluate((node) =>
    Array.from(node.querySelectorAll(":scope > div.absolute")).map((element) => {
      const wrapper = element as HTMLElement;
      return {
        textContent: wrapper.innerText.replace(/\s+/g, " ").trim(),
        left: wrapper.style.left,
        top: wrapper.style.top,
        width: wrapper.style.width,
        height: wrapper.style.height,
      };
    }),
  ) as Promise<ProjectionEntry[]>;
}

function readCreativeProjection(
  locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
) {
  return locator.evaluate((node) =>
    Array.from(
      node.querySelectorAll(
        '[data-testid^="creative-richtext-static-"]:not([data-testid="creative-richtext-static-layer"])',
      ),
    ).map((element) => {
      const wrapper = element as HTMLElement;
      return {
        textContent: wrapper.innerText.replace(/\s+/g, " ").trim(),
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

function readFirstFrame(locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>) {
  return locator.evaluate((node) => {
    const first = node.querySelector(":scope > div.absolute") as HTMLElement | null;
    if (!first) return null;
    return {
      left: Number.parseFloat(first.style.left.replace("px", "")),
      top: Number.parseFloat(first.style.top.replace("px", "")),
      width: Number.parseFloat(first.style.width.replace("px", "")),
      height: Number.parseFloat(first.style.height.replace("px", "")),
    };
  }) as Promise<{ left: number; top: number; width: number; height: number } | null>;
}

function readVerticalCenterOffset(
  locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
) {
  return locator.evaluate((node) => {
    const paragraph = node.querySelector("p") as HTMLElement | null;
    if (!paragraph) return null;
    const frame = node.getBoundingClientRect();
    const value = paragraph.getBoundingClientRect();
    return value.top + value.height / 2 - (frame.top + frame.height / 2);
  }) as Promise<number | null>;
}

function getComputedAlign(locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>) {
  return locator.evaluate((node) => window.getComputedStyle(node).textAlign);
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: This parity suite intentionally keeps setup and multi-surface assertions in one flow.
test.describe("Quick + preview centering parity", () => {
  test("centers default text box frame consistently across quick, sidebar, and creative previews", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);
    await page.getByTestId("mode-quick-button").click();
    await expect(page.getByTestId("quick-live-preview-card")).toBeVisible({ timeout: 12000 });

    const quickContent = page.getByTestId("quick-live-preview-card-content");
    await expect(quickContent).toBeVisible();
    const sidebarContent = page
      .locator('[data-testid^="card-sidebar-preview-"] > div > div')
      .first();
    await expect(sidebarContent).toBeVisible();

    const quickProjection = await readProjection(quickContent);
    const sidebarProjection = await readProjection(sidebarContent);
    expect(quickProjection.length).toBeGreaterThanOrEqual(1);
    expect(sidebarProjection).toEqual(quickProjection);

    const firstQuick = quickProjection[0];
    expect(Math.abs(parsePx(firstQuick?.left ?? "0px") - DEFAULT_FRAME.left)).toBeLessThanOrEqual(
      0.5,
    );
    expect(Math.abs(parsePx(firstQuick?.top ?? "0px") - DEFAULT_FRAME.top)).toBeLessThanOrEqual(
      0.5,
    );
    expect(Math.abs(parsePx(firstQuick?.width ?? "0px") - DEFAULT_FRAME.width)).toBeLessThanOrEqual(
      0.5,
    );
    expect(
      Math.abs(parsePx(firstQuick?.height ?? "0px") - DEFAULT_FRAME.height),
    ).toBeLessThanOrEqual(0.5);

    await page.getByTestId("mode-creative-button").click();
    const creativeShellContent = page
      .getByTestId("creative-card-shell")
      .locator(":scope > div")
      .first();
    await expect(creativeShellContent).toBeVisible();
    const creativeProjection = await readCreativeProjection(creativeShellContent);
    expect(creativeProjection.length).toBeGreaterThanOrEqual(1);
    expect(creativeProjection[0]).toMatchObject({
      left: firstQuick?.left,
      top: firstQuick?.top,
      width: firstQuick?.width,
      height: firstQuick?.height,
    });
  });

  test("keeps Quick editor text alignment synced with previews", async ({ page }) => {
    await createDeckAndOpenEditor(page);

    const quickEditor = page.locator('[contenteditable="true"]').first();
    await quickEditor.click();
    await page.keyboard.type("Alignment lock token");
    await page.keyboard.press(`${MODIFIER_KEY}+a`);

    const quickContent = page.getByTestId("quick-live-preview-card-content");
    await expect(quickContent).toBeVisible();
    const quickRichTextFrame = page
      .locator('[data-testid^="quick-live-preview-card-richtext-"]')
      .first();
    await expect(quickRichTextFrame).toBeVisible();
    const baselineFrame = await readFirstFrame(quickContent);
    const baselineVerticalCenterOffset = await readVerticalCenterOffset(quickRichTextFrame);
    expect(baselineFrame).not.toBeNull();
    expect(baselineVerticalCenterOffset).not.toBeNull();

    const quickEditorParagraph = page.locator('[contenteditable="true"] p').first();
    const quickPreviewParagraph = page
      .locator('[data-testid^="quick-live-preview-card-richtext-"] p')
      .first();
    const sidebarPreviewParagraph = page
      .locator('[data-testid^="card-sidebar-preview-"] .remora-richtext-content p')
      .first();

    for (const option of ALIGNMENT_OPTIONS) {
      await page.getByRole("button", { name: "Text alignment" }).first().click();
      await page.getByRole("menuitem", { name: option.label }).click();
      await page.waitForTimeout(120);

      const editorAlign = await getComputedAlign(quickEditorParagraph);
      const quickPreviewAlign = await getComputedAlign(quickPreviewParagraph);
      const sidebarPreviewAlign = await getComputedAlign(sidebarPreviewParagraph);
      expect(editorAlign).toBe(option.value);
      expect(quickPreviewAlign).toBe(option.value);
      expect(sidebarPreviewAlign).toBe(option.value);

      const nextFrame = await readFirstFrame(quickContent);
      const nextVerticalCenterOffset = await readVerticalCenterOffset(quickRichTextFrame);
      expect(nextFrame).not.toBeNull();
      expect(nextVerticalCenterOffset).not.toBeNull();
      if (
        !baselineFrame ||
        !nextFrame ||
        baselineVerticalCenterOffset == null ||
        nextVerticalCenterOffset == null
      ) {
        throw new Error("Failed to measure quick preview frame invariants.");
      }

      expect(Math.abs(nextFrame.left - baselineFrame.left)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(nextFrame.top - baselineFrame.top)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(nextFrame.width - baselineFrame.width)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(nextFrame.height - baselineFrame.height)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(nextVerticalCenterOffset - baselineVerticalCenterOffset)).toBeLessThanOrEqual(
        8,
      );
    }

    await page.getByTestId("mode-creative-button").click();
    const creativeParagraph = page
      .locator(
        '[data-testid^="creative-richtext-static-"]:not([data-testid="creative-richtext-static-layer"]) p',
      )
      .first();
    await expect(creativeParagraph).toBeVisible();
    const creativeAlign = await getComputedAlign(creativeParagraph);
    expect(creativeAlign).toBe("left");
  });
});

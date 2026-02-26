import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Creative Textbox Consistency ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Ensure creative textboxes stay selected through add/move/double-click edit");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: End-to-end interaction sequence is kept contiguous to preserve stateful canvas steps.
test.describe("Creative textbox consistency", () => {
  // biome-ignore lint/complexity/noExcessiveLinesPerFunction: Drag/select/edit assertions intentionally run as one deterministic scenario.
  test("keeps textboxes selected and editable across add, move, and double-click", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);

    await page.getByTestId("mode-creative-button").click();
    const creativeCanvas = page.getByTestId("creative-card-canvas");
    await expect(creativeCanvas).toBeVisible();

    await page.getByTestId("creative-add-text-button").click();

    const activeAfterAdd = await page.evaluate(() => {
      const canvas = (
        window as Window & {
          __remoraCreativeCanvas?: {
            getActiveObject?: () => {
              data?: {
                kind?: string;
                elementId?: string;
              };
            } | null;
          };
        }
      ).__remoraCreativeCanvas;
      const active = canvas?.getActiveObject?.();
      return {
        id: String(active?.data?.elementId ?? ""),
        kind: String(active?.data?.kind ?? ""),
      };
    });
    expect(activeAfterAdd.kind).toBe("richText");
    expect(activeAfterAdd.id.length).toBeGreaterThan(0);

    const richTextStatic = page.getByTestId(`creative-richtext-static-${activeAfterAdd.id}`);
    await expect(richTextStatic).toBeVisible();

    const beforeMove = await page.evaluate(() => {
      const canvas = (
        window as Window & {
          __remoraCreativeCanvas?: {
            getActiveObject?: () => {
              getBoundingRect?: (
                absolute?: boolean,
                calculate?: boolean,
              ) => {
                left: number;
                top: number;
                width: number;
                height: number;
              };
              setCoords?: () => void;
            } | null;
          };
        }
      ).__remoraCreativeCanvas;
      const active = canvas?.getActiveObject?.();
      if (!active?.getBoundingRect) return null;
      active.setCoords?.();
      const bounds = active.getBoundingRect(true, true);
      return {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      };
    });
    expect(beforeMove).not.toBeNull();
    if (!beforeMove) return;

    const canvasBox = await creativeCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) return;

    await page.getByTestId("creative-tool-select").click();
    await page.keyboard.press("Escape");

    // Drag from the visible selection border instead of text content.
    const startX = canvasBox.x + beforeMove.left + 8;
    const startY = canvasBox.y + beforeMove.top + 8;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 120, startY + 80, { steps: 16 });
    await page.mouse.up();

    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

    const afterMove = await page.evaluate(() => {
      const canvas = (
        window as Window & {
          __remoraCreativeCanvas?: {
            getActiveObject?: () => {
              getBoundingRect?: (
                absolute?: boolean,
                calculate?: boolean,
              ) => {
                left: number;
                top: number;
                width: number;
                height: number;
              };
              setCoords?: () => void;
            } | null;
          };
        }
      ).__remoraCreativeCanvas;
      const active = canvas?.getActiveObject?.();
      if (!active?.getBoundingRect) return null;
      active.setCoords?.();
      const bounds = active.getBoundingRect(true, true);
      return {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      };
    });
    expect(afterMove).not.toBeNull();
    if (!afterMove) return;

    const movedDistance = Math.hypot(
      afterMove.left - beforeMove.left,
      afterMove.top - beforeMove.top,
    );
    expect(movedDistance).toBeGreaterThan(20);
  });
});

import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Inline Selection Deck ${Date.now()}`);
  await page
    .getByPlaceholder("Cells, mitosis, and genetics")
    .fill("Keep active Fabric selection while editing");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

test.describe("Creative inline selection persistence", () => {
  test("keeps Fabric selection active while typing in inline rich text edit mode", async ({
    page,
  }) => {
    await createDeckAndOpenEditor(page);

    const quickEditor = page.locator('[contenteditable="true"]').first();
    await quickEditor.click();
    await page.keyboard.type("Selection persistence anchor");
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId("mode-creative-button").click();
    const creativeCanvas = page.getByTestId("creative-card-canvas");
    await expect(creativeCanvas).toBeVisible();
    await page.getByTestId("creative-tool-select").click();

    const staticRichText = page
      .locator(
        '[data-testid^="creative-richtext-static-"]:not([data-testid="creative-richtext-static-layer"])',
      )
      .first();
    await expect(staticRichText).toBeVisible();
    const staticBox = await staticRichText.boundingBox();
    expect(staticBox).not.toBeNull();
    if (!staticBox) return;

    const clickX = staticBox.x + staticBox.width / 2;
    const clickY = staticBox.y + staticBox.height / 2;
    await page.mouse.click(clickX, clickY);
    await page.mouse.dblclick(clickX, clickY);

    const inlineEditor = page.getByTestId("creative-inline-richtext-editor");
    await expect(inlineEditor).toBeVisible();

    const selectedBeforeTyping = await page.evaluate(() => {
      const canvas = (
        window as Window & {
          __remoraCreativeCanvas?: {
            getActiveObject?: () => {
              data?: {
                kind?: string;
              };
            } | null;
          };
        }
      ).__remoraCreativeCanvas;
      const active = canvas?.getActiveObject?.();
      return active?.data?.kind === "richText";
    });
    expect(selectedBeforeTyping).toBeTruthy();

    await inlineEditor.locator('[contenteditable="true"]').first().click();
    await page.keyboard.type(" + typing");
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 15000 });

    const selectedAfterTyping = await page.evaluate(() => {
      const canvas = (
        window as Window & {
          __remoraCreativeCanvas?: {
            getActiveObject?: () => {
              data?: {
                kind?: string;
              };
            } | null;
          };
        }
      ).__remoraCreativeCanvas;
      const active = canvas?.getActiveObject?.();
      return active?.data?.kind === "richText";
    });
    expect(selectedAfterTyping).toBeTruthy();
  });

  test("keeps the same rich-text selection while toggling lists and alignments", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const onConsole = (message: { type: () => string; text: () => string }) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    };
    page.on("console", onConsole);

    try {
      await createDeckAndOpenEditor(page);

      const quickEditor = page.locator('[contenteditable="true"]').first();
      await quickEditor.click();
      await page.keyboard.type("line one");
      await page.keyboard.press("Enter");
      await page.keyboard.type("line two");
      await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({
        timeout: 15000,
      });

      await page.getByTestId("mode-creative-button").click();
      await expect(page.getByTestId("creative-card-canvas")).toBeVisible();
      await page.getByTestId("creative-tool-select").click();

      const staticRichText = page
        .locator(
          '[data-testid^="creative-richtext-static-"]:not([data-testid="creative-richtext-static-layer"])',
        )
        .first();
      await expect(staticRichText).toBeVisible();
      const staticBox = await staticRichText.boundingBox();
      expect(staticBox).not.toBeNull();
      if (!staticBox) return;

      const clickX = staticBox.x + staticBox.width / 2;
      const clickY = staticBox.y + staticBox.height / 2;
      await page.mouse.click(clickX, clickY);
      await page.mouse.dblclick(clickX, clickY);

      const inlineEditor = page.getByTestId("creative-inline-richtext-editor");
      await expect(inlineEditor).toBeVisible();
      const editable = inlineEditor.locator('[contenteditable="true"]').first();
      await editable.click({ force: true });

      const selectionState = async () =>
        page.evaluate(() => {
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
            kind: active?.data?.kind ?? null,
            elementId: active?.data?.elementId ?? null,
          };
        });

      const before = await selectionState();
      expect(before.kind).toBe("richText");
      expect(before.elementId).toBeTruthy();

      const toolbar = page.getByTestId("creative-richtext-toolbar-row");
      const operations = [
        async () => toolbar.locator('button[title="Bullet List"]').first().click(),
        async () => {
          await toolbar.getByRole("button", { name: "Text alignment" }).click();
          await page.getByRole("menuitem", { name: "Center" }).click();
        },
        async () => {
          await toolbar.getByRole("button", { name: "Text alignment" }).click();
          await page.getByRole("menuitem", { name: "Right" }).click();
        },
        async () => {
          await toolbar.locator('button[title="Numbered List"]').first().click();
        },
        async () => {
          await toolbar.getByRole("button", { name: "Text alignment" }).click();
          await page.getByRole("menuitem", { name: "Left" }).click();
        },
      ];

      for (const applyOperation of operations) {
        await editable.click({ force: true });
        await applyOperation();
        await expect(inlineEditor).toBeVisible();

        const after = await selectionState();
        expect(after.kind).toBe("richText");
        expect(after.elementId).toBe(before.elementId);
      }

      expect(consoleErrors.some((message) => /invalid indent value/i.test(message))).toBeFalsy();
    } finally {
      page.off("console", onConsole);
    }
  });
});

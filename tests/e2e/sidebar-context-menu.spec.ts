import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./utils/clerkAuth";

async function createDeckAndOpenEditor(page: Parameters<typeof test>[0]["page"]) {
  await signInAsOwner(page);
  await page.goto("/app/decks/new");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="newdeck-hydrated"]')?.textContent?.trim() === "yes",
  );

  await page.getByPlaceholder("Biology Midterm").fill(`Sidebar Menu Deck ${Date.now()}`);
  await page.getByPlaceholder("Cells, mitosis, and genetics").fill("Sidebar context menu");
  await page.getByRole("button", { name: "Create Deck" }).click();
  await expect(page).toHaveURL(/\/app\/decks\/[^/]+\/edit\/card\/[^/]+/);
}

test.describe("Sidebar context menu", () => {
  test("shows insight-style right-click options for section and card", async ({ page }) => {
    await createDeckAndOpenEditor(page);

    await page.getByText("Section 1").first().click({ button: "right" });
    await expect(page.getByRole("button", { name: "New card" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rename section" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete section" })).toBeVisible();
    await page.mouse.click(5, 5);

    const firstCard = page.locator('[data-testid^="card-sidebar-preview-"]').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click({ button: "right" });

    await expect(page.getByRole("button", { name: "New card" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Move to Section" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete card" })).toBeVisible();
  });

  test("renames and deletes a section from section right-click menu", async ({ page }) => {
    await createDeckAndOpenEditor(page);

    await page.getByRole("button", { name: /section/i }).first().click();
    await expect(page.getByText("Section 2").first()).toBeVisible();

    const renamedTitle = `Renamed Section ${Date.now()}`;
    page.once("dialog", (dialog) => dialog.accept(renamedTitle));
    await page.getByText("Section 2").first().click({ button: "right" });
    await page.getByRole("button", { name: "Rename section" }).click();
    await expect(page.getByText(renamedTitle).first()).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByText(renamedTitle).first().click({ button: "right" });
    await page.getByRole("button", { name: "Delete section" }).click();
    await expect(page.getByText(renamedTitle).first()).toHaveCount(0);
  });
});

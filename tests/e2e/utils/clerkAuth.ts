import { createClerkClient } from "@clerk/backend";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import type { Page } from "@playwright/test";

const ensuredUsers = new Set<string>();

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? "remora.owner.e2e@example.com";

async function ensureClerkUser(emailAddress: string) {
  if (ensuredUsers.has(emailAddress)) return;

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is required for Playwright email ticket sign-in.");
  }

  const client = createClerkClient({
    secretKey,
    apiUrl: process.env.CLERK_API_URL,
  });

  const existing = await client.users.getUserList({
    emailAddress: [emailAddress],
    limit: 1,
  });

  if (!existing.data?.length) {
    await client.users.createUser({
      emailAddress: [emailAddress],
      skipPasswordRequirement: true,
      skipLegalChecks: true,
    });
  }

  ensuredUsers.add(emailAddress);
}

export async function signInAsOwner(page: Page) {
  await page.goto("/");
  await setupClerkTestingToken({ page });
  await ensureClerkUser(OWNER_EMAIL);
  await clerk.signIn({ page, emailAddress: OWNER_EMAIL });
  await page.goto("/app/decks");
}

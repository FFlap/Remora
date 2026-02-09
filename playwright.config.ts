import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3001);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

const shouldStartWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER !== "1";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global.setup.ts",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: shouldStartWebServer
    ? {
        command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
        url: baseURL,
        timeout: 120000,
        reuseExistingServer: true,
      }
    : undefined,
});

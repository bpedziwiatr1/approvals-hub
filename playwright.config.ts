import { defineConfig } from "@playwright/test";

// 127.0.0.1 everywhere: "localhost" may resolve to ::1 first on Windows while the dev server listens on IPv4 only.
const ORIGIN = "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  expect: { timeout: 10_000 },
  use: { baseURL: ORIGIN },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
    url: ORIGIN,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

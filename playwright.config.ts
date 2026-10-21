import { defineConfig, devices } from "@playwright/test";
import { loadTestEnv } from "./test-env";

loadTestEnv();

const port = 3100;
const baseURL = `http://localhost:${port}`;
// Ten sam build w trybie demo (STACK 7): osobny serwer i projekt testów.
const demoPort = 3101;
const demoURL = `http://localhost:${demoPort}`;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  // Testy współdzielą jedną bazę testową i czyszczą ją przed każdym testem
  // (fixture logowania), więc działają po kolei, nie równolegle.
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: "demo/**",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "demo",
      testMatch: "demo/**/*.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: demoURL },
    },
  ],
  // Testy działają na buildzie produkcyjnym (STACK 7), więc najpierw `npm run build`.
  webServer: [
    {
      command: `npm run start -- --port ${port}`,
      url: baseURL,
      env: { APP_MODE: "private" },
      reuseExistingServer: false,
    },
    {
      command: `npm run start -- --port ${demoPort}`,
      url: demoURL,
      env: { APP_MODE: "demo" },
      reuseExistingServer: false,
    },
  ],
});

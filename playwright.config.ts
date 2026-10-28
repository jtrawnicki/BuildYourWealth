import { defineConfig, devices } from "@playwright/test";
import { loadTestEnv } from "./test-env";

loadTestEnv();

const port = 3100;
const baseURL = `http://localhost:${port}`;
// Ten sam build w trybie demo (STACK 7): osobny serwer i projekt testów.
const demoPort = 3101;
const demoURL = `http://localhost:${demoPort}`;
// Port 9 (discard) nie przyjmuje połączeń: odpowiada scen. 24 „NBP nie odpowiada”.
const CLOSED_NBP_URL = "http://127.0.0.1:9";

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
  // E2E nigdy nie łączy się z NBP: adres wskazuje zamknięty port („NBP nie
  // odpowiada”), a kursy wstawia `seedRates` z `e2e/db.ts` (STACK 5 „Kurs NBP”).
  webServer: [
    {
      command: `npm run start -- --port ${port}`,
      url: baseURL,
      env: { APP_MODE: "private", NBP_API_URL: CLOSED_NBP_URL },
      reuseExistingServer: false,
    },
    {
      command: `npm run start -- --port ${demoPort}`,
      url: demoURL,
      // Sekret skrótu IP wymagany w trybie demo (STACK 5); w E2E dowolna wartość.
      env: {
        APP_MODE: "demo",
        DEMO_IP_SECRET: "e2e-demo-ip-secret",
        NBP_API_URL: CLOSED_NBP_URL,
      },
      reuseExistingServer: false,
    },
  ],
});

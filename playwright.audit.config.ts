import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

// Конфиг отдельного аудита качества вёрстки/мобильной версии.
// Основной `playwright.config.ts` matcher'ом `**/*.spec.ts` эти файлы
// не подхватывает — аудиторские спеки живут в tests/audit/*.audit.ts.
// Запуск: npx playwright test -c playwright.audit.config.ts [группа]
const baseURL = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests/audit",
  testMatch: "**/*.audit.ts",
  fullyParallel: true,
  retries: 0,
  timeout: 600_000, // свип-тесты проходят сотни viewport внутри одного теста
  workers: process.env.CI ? 2 : 6,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "audit-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "audit-firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "audit-webkit", use: { ...devices["Desktop Safari"] } },
    {
      // Полное touch-эмулирование iPhone для интерактивных проверок
      name: "audit-iphone",
      use: { ...devices["iPhone 15 Pro"] },
    },
  ],
  webServer: {
    command: `node .output/server/index.mjs --port ${new URL(baseURL).port || "4173"}`,
    url: baseURL,
    env: {
      MOYSKLAD_SNAPSHOT_PATH: resolve("tests/fixtures/catalog.json"),
      ACCOUNT_DATA_DIR: resolve("test-results/account-data"),
      RESERVATION_DATA_DIR: resolve("test-results/reservation-data"),
      SESSION_COOKIE_INSECURE: "1",
      AUTH_RATE_LIMIT_REGISTER: "1000",
      AUTH_RATE_LIMIT_LOGIN: "1000",
      RESERVATION_RATE_LIMIT_MAX: "1000",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

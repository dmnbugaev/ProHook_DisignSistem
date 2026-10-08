import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  // Dev-сервер под полной параллельной нагрузкой изредка роняет запросы
  // (WebKit репортит это как access control) — один повтор снимает флак,
  // не пряча детерминированные падения.
  retries: process.env.CI ? 2 : 1,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: process.env.PLAYWRIGHT_BASE_URL
      ? `npm run preview -- --port ${new URL(baseURL).port || "3000"}`
      : "npm run dev",
    url: baseURL,
    env: {
      MOYSKLAD_SNAPSHOT_PATH: resolve("tests/fixtures/catalog.json"),
      // Изолированные аккаунты тестов; Secure-cookie отключается для
      // локальной проверки production-сборки по http. Пороги rate-limit
      // подняты: все спецификации идут с одного 127.0.0.1.
      ACCOUNT_DATA_DIR: resolve("test-results/account-data"),
      RESERVATION_DATA_DIR: resolve("test-results/reservation-data"),
      SESSION_COOKIE_INSECURE: "1",
      AUTH_RATE_LIMIT_REGISTER: "1000",
      AUTH_RATE_LIMIT_LOGIN: "1000",
      RESERVATION_RATE_LIMIT_MAX: "1000",
      // Капча и Telegram-уведомления в e2e отключены (нет ключей);
      // их логика покрыта unit-тестами (tests/reservation.test.mjs).
    },
    reuseExistingServer: !process.env.CI && !process.env.PLAYWRIGHT_BASE_URL,
    timeout: 120000,
  },
});

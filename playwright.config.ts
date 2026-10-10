import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

// Cookie-согласие «только необходимые» предустановлено всем контекстам:
// баннер согласия закрывает нижнюю часть экрана на каждой странице и
// перехватывал клики по контенту в спецификациях своих страниц. Поведение
// самого баннера покрыто tests/consent.spec.ts (там cookie очищается),
// тесты Метрики подменяют значение на согласие.
const consentAnswered = {
  cookies: [
    {
      name: "prohook-consent",
      value: '{"v":1,"analytics":false,"ts":1}',
      domain: new URL(baseURL).hostname,
      path: "/",
      expires: 2000000000,
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    },
  ],
};

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  // Dev-сервер под полной параллельной нагрузкой изредка роняет запросы
  // (WebKit репортит это как access control) — один повтор снимает флак,
  // не пряча детерминированные падения.
  retries: process.env.CI ? 2 : 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    storageState: consentAnswered,
  },
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
      // Проброс режима Метрики: с NUXT_PUBLIC_METRIKA_ENABLED=1
      // dev-сервер грузит счётчик и выполняется tests/metrika.spec.ts
      // (сеть до mc.yandex.ru блокируется внутри спеки — реальный
      // счётчик не загрязняется). По умолчанию счётчик отключён.
      ...(process.env.NUXT_PUBLIC_METRIKA_ENABLED
        ? {
            NUXT_PUBLIC_METRIKA_ENABLED:
              process.env.NUXT_PUBLIC_METRIKA_ENABLED,
          }
        : {}),
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

import { test, expect, type Page } from "@playwright/test";

// Cookie-баннер (152-ФЗ): компактное согласие на аналитические cookie —
// «Принять» (аналитика) и «×» (закрыть = отказ, только необходимые).
// Проверки, затрагивающие Яндекс Метрику, выполняются только при
// NUXT_PUBLIC_METRIKA_ENABLED=1 (как в tests/metrika.spec.ts): сеть до
// mc.yandex.ru подменяется заглушкой, реальный счётчик не загрязняется.

const metrikaEnabled = process.env.NUXT_PUBLIC_METRIKA_ENABLED === "1";

const REGION = "Использование файлов cookie";
const CONSENT_COOKIE = '{"v":1,"analytics":true,"ts":1}';

/** Решение по cookie (useCookie пишет JSON, возможно URL-кодированно). */
async function consentCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find((item) => item.name === "prohook-consent")?.value ?? "";
}

test.beforeEach(async ({ context }) => {
  // playwright.config.ts предустанавливает всем контекстам cookie
  // согласия (чтобы баннер не перекрывал контент в чужих спецификациях) —
  // здесь он не нужен: баннер проверяется на «нового» посетителя.
  await context.clearCookies();
  await context.route("**://mc.yandex.ru/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "/* stub */",
    });
  });
});

test("баннер показывается новому посетителю: краткий текст, принять и закрыть", async ({
  page,
}) => {
  await page.goto("/privacy");
  const banner = page.getByRole("region", { name: REGION });
  await expect(banner).toBeVisible();
  await expect(banner.getByRole("link", { name: "Подробнее" })).toHaveAttribute(
    "href",
    "/privacy#cookies",
  );
  await expect(banner.getByRole("button", { name: "Принять" })).toBeVisible();
  await expect(banner.getByRole("button", { name: "Закрыть" })).toBeVisible();
  // Настройки/чекбоксы в компактном баннере отсутствуют.
  await expect(banner.getByRole("checkbox")).toHaveCount(0);
});

test("закрытие крестиком — отказ: аналитика не подключается, решение помнится", async ({
  page,
}) => {
  await page.goto("/privacy");
  const banner = page.getByRole("region", { name: REGION });
  await banner.getByRole("button", { name: "Закрыть" }).click();
  await expect(banner).toBeHidden();
  expect(decodeURIComponent(await consentCookie(page))).toContain(
    '"analytics":false',
  );
  if (metrikaEnabled) {
    expect(await page.locator('script[src*="mc.yandex.ru"]').count()).toBe(0);
  }
  await page.reload();
  await expect(page.getByRole("region", { name: REGION })).toBeHidden();
});

test("принять — согласие сохраняется, счётчик подключается", async ({
  page,
}) => {
  await page.goto("/privacy");
  await page.getByRole("button", { name: "Принять" }).click();
  await expect(page.getByRole("region", { name: REGION })).toBeHidden();
  expect(decodeURIComponent(await consentCookie(page))).toContain(
    '"analytics":true',
  );
  if (metrikaEnabled) {
    await expect
      .poll(() => page.locator('script[src*="mc.yandex.ru"]').count(), {
        timeout: 15000,
      })
      .toBe(1);
  }
});

test("футер открывает баннер повторно; отзыв согласия останавливает метрику", async ({
  page,
}) => {
  test.skip(!metrikaEnabled, "Метрика: NUXT_PUBLIC_METRIKA_ENABLED=1");
  await page.context().addCookies([
    {
      name: "prohook-consent",
      value: CONSENT_COOKIE,
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto("/privacy");
  // Согласие уже дано — баннера нет, счётчик загружен.
  await expect(page.getByRole("region", { name: REGION })).toBeHidden();
  await expect
    .poll(() => page.locator('script[src*="mc.yandex.ru"]').count(), {
      timeout: 15000,
    })
    .toBe(1);
  // «Файлы cookie» в футере открывает баннер заново; «×» отзывает
  // согласие: перезагрузка, удаление идентификаторов, скрипт не грузится.
  await page.getByRole("button", { name: "Файлы cookie" }).click();
  const banner = page.getByRole("region", { name: REGION });
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Закрыть" }).click();
  await expect
    .poll(async () => page.locator('script[src*="mc.yandex.ru"]').count(), {
      timeout: 15000,
    })
    .toBe(0);
  expect(decodeURIComponent(await consentCookie(page))).toContain(
    '"analytics":false',
  );
  await expect(page.getByRole("region", { name: REGION })).toBeHidden();
});

test("до подтверждения 18+ баннер не показывается, после — появляется", async ({
  page,
}) => {
  await page.goto("/catalog");
  const gate = page.getByRole("dialog", {
    name: "Вам уже исполнилось 18 лет?",
  });
  await expect(gate).toBeVisible();
  await expect(page.getByRole("region", { name: REGION })).toBeHidden();
  await gate.getByRole("button", { name: "Мне 18 лет или больше" }).click();
  await expect(page.getByRole("region", { name: REGION })).toBeVisible();
});

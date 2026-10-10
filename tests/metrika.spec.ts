import { test, expect, type Page } from "@playwright/test";

// Проверка интеграции Яндекс Метрики 113582832 «на живом» приложении.
// Спека запускается только при NUXT_PUBLIC_METRIKA_ENABLED=1
// (пробрасывается в webServer из playwright.config.ts): dev-сервер
// грузит счётчик, а все запросы к mc.yandex.ru перехватываются и
// заменяются заглушкой — реальный счётчик тестовым трафиком не
// загрязняется. Без этого режима спека пропускается.

const enabled = process.env.NUXT_PUBLIC_METRIKA_ENABLED === "1";

test.skip(
  !enabled,
  "интеграция Метрики: запустите с NUXT_PUBLIC_METRIKA_ENABLED=1",
);

const COUNTER = 113582832;

/** Очередь официального загрузчика: ym.a = [[id, method, ...args], ...]. */
type YmQueueCall = [unknown, string, ...unknown[]];

async function ymQueue(page: Page): Promise<YmQueueCall[]> {
  return page.evaluate(() => {
    const ym = (window as unknown as { ym?: { a?: unknown[][] } }).ym;
    return (ym?.a ?? []) as YmQueueCall[];
  });
}

test.beforeEach(async ({ context }) => {
  // Счётчик грузится только при согласии на аналитические cookie
  // (см. tests/consent.spec.ts) — заранее даём его, как вернувшийся
  // посетитель, согласившийся через баннер.
  await context.addCookies([
    {
      name: "prohook-consent",
      value: '{"v":1,"analytics":true,"ts":1}',
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  // Официальный загрузчик работает до загрузки tag.js: очередь ym.a
  // копит вызовы — этого достаточно для всех проверок ниже.
  await context.route("**://mc.yandex.ru/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "/* stub */",
    });
  });
});

test("скрипт tag.js подключается один раз с правильным id", async ({
  page,
}) => {
  await page.goto("/");
  // В dev-режиме клиентский плагин стартует после load — ждём появления.
  await expect
    .poll(() => page.locator('script[src*="mc.yandex.ru"]').count(), {
      timeout: 15000,
    })
    .toBe(1);
  const srcs = await page.evaluate(() =>
    Array.from(document.scripts)
      .map((s) => s.src)
      .filter((src) => src.includes("mc.yandex.ru")),
  );
  expect(srcs).toHaveLength(1);
  expect(srcs[0]).toBe(`https://mc.yandex.ru/metrika/tag.js?id=${COUNTER}`);
});

test("init вызывается ровно один раз; SPA-переход даёт hit, не второй init", async ({
  page,
}) => {
  await page.goto("/");
  await expect
    .poll(async () => (await ymQueue(page)).length, { timeout: 15000 })
    .toBeGreaterThan(0);
  // init учтён один раз; исходный просмотр не дублируется hit'ом.
  let queue = await ymQueue(page);
  expect(queue.map((call) => String(call[0]))).toEqual([String(COUNTER)]);

  const init = queue.find((call) => call[1] === "init");
  expect(init?.[0]).toBe(COUNTER);
  expect(init?.[2]).toMatchObject({
    webvisor: true,
    clickmap: true,
    accurateTrackBounce: true,
    trackLinks: true,
    ecommerce: "dataLayer",
  });

  // Клиентский переход (SPA): hit без повторной init. Клик ждёт
  // гидрации, иначе сработает нативный переход с полной перезагрузкой.
  await page.waitForFunction(() => {
    const root = document.getElementById("__nuxt") as
      (HTMLElement & { __vue_app__?: unknown }) | null;
    return !!root?.__vue_app__;
  });
  await page.click('a[href="/about"]');
  await page.waitForURL("/about");
  await expect
    .poll(
      async () =>
        (await ymQueue(page)).filter((call) => call[1] === "hit").length,
      { timeout: 5000 },
    )
    .toBe(1);
  queue = await ymQueue(page);
  expect(queue.filter((call) => call[1] === "init")).toHaveLength(1);
  const hit = queue.find((call) => call[1] === "hit");
  expect(hit?.[2]).toBe("/about");
  expect((hit?.[3] as { referer: string }).referer).toBe("/");
});

test("reachGoal: событие интерфейса уходит с безопасными параметрами", async ({
  page,
}) => {
  // Выбранный магазин в cookie предотвращает автозапуск диалога выбора;
  // id — из фикстуры каталога (tests/fixtures/catalog.json).
  await page.context().addCookies([
    {
      name: "prohook-age-confirmed",
      value: "true",
      domain: "127.0.0.1",
      path: "/",
    },
    {
      name: "prohook-store",
      value: "store-3",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto("/stores");
  // Клик до гидрации Vue уходит «в никуда» (обработчики ещё не навешаны):
  // ждём монтирования приложения (см. память проекта по e2e).
  await page.waitForFunction(() => {
    const root = document.getElementById("__nuxt") as
      (HTMLElement & { __vue_app__?: unknown }) | null;
    return !!root?.__vue_app__;
  });
  // Клик «Выбрать эту точку» — store_location_view c storeId.
  await page.getByRole("button", { name: "Выбрать эту точку" }).first().click();
  await expect
    .poll(
      async () =>
        (await ymQueue(page)).some(
          (call) =>
            call[1] === "reachGoal" && call[2] === "store_location_view",
        ),
      { timeout: 10000 },
    )
    .toBe(true);
  // На /stores первым уходит store_hours_view (onMounted) — ищем именно
  // кликовое событие.
  const goal = (await ymQueue(page)).find(
    (call) => call[1] === "reachGoal" && call[2] === "store_location_view",
  );
  expect(goal?.[0]).toBe(COUNTER);
  expect(goal?.[2]).toBe("store_location_view");
  // Параметры — только allowlist-ключи; персональных данных нет.
  const params = (goal?.[3] ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(params))
    expect(["storeId", "source"]).toContain(key);
  expect(String(params.storeId)).not.toMatch(/\+7|\d{5,}/);
});

test("noscript-пиксель присутствует в SSR-HTML только при согласии на аналитику", async () => {
  // Прямой fetch без cookie-jar Playwright: request-фикстуре предустановлен
  // cookie согласия из playwright.config.ts (см. комментарий там), а
  // собственный контекст наследует тот же storageState. Согласие
  // передаётся заголовком — как возрастной гейт в legal.spec.ts.
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
  const ssrHtml = async (consent: string) => {
    const response = await fetch(base + "/", {
      headers: { cookie: `prohook-consent=${consent}` },
    });
    return response.text();
  };
  expect(await ssrHtml('{"v":1,"analytics":true,"ts":1}')).toContain(
    `https://mc.yandex.ru/watch/${COUNTER}`,
  );
  expect(await ssrHtml('{"v":1,"analytics":false,"ts":1}')).not.toContain(
    `https://mc.yandex.ru/watch/${COUNTER}`,
  );
});

import { test, expect } from "@playwright/test";

// Технический SEO-контур: robots.txt, sitemap, файл подтверждения
// Яндекс Вебмастера, canonical, per-page robots, JSON-LD, HTTP-статусы
// (включая 404 для несуществующих категорий/товаров без age cookie).
// Индексируемый контур — только информационные страницы; каталог и
// карточки товаров обязаны оставаться noindex и не отдавать контент
// в SSR до подтверждения 18+ (юридический инвариант, 38-ФЗ ст. 7).

const INDEXABLE = [
  "/",
  "/about",
  "/stores",
  "/contacts",
  "/information",
  "/partners",
  "/privacy",
  "/personal-data",
];

const NOINDEX = [
  "/catalog",
  "/product/stands-01",
  "/search",
  "/login",
  "/register",
  "/account",
  "/reserve",
];

const SITE = "https://xn--j1ahceql.xn--p1ai";

/** Все meta robots из HTML (устойчиво к порядку атрибутов). */
function robotsMetas(html: string) {
  return (
    html
      .match(/<meta\b[^>]*name="robots"[^>]*>/g)
      ?.map((tag) => /content="([^"]*)"/.exec(tag)?.[1] ?? "") ?? []
  );
}

test("robots.txt: гранулярные правила и Sitemap", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("User-agent: *");
  // Приватные и служебные маршруты закрыты от обхода.
  for (const disallowed of [
    "/account",
    "/login",
    "/register",
    "/reserve",
    "/search",
    "/design-system",
    "/api/",
    "/product/",
  ])
    expect(body, `Disallow ${disallowed}`).toContain(`Disallow: ${disallowed}`);
  // Сайт больше не закрыт целиком.
  expect(body).not.toMatch(/Disallow:\s*\/\s*$/m);
  // CSS/JS не закрыты.
  expect(body).not.toContain("Disallow: /_nuxt");
  expect(body).toContain(`Sitemap: ${SITE}/sitemap.xml`);
});

test("sitemap.xml: только индексируемые страницы, punycode, без дублей", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/xml");
  const xml = await response.text();
  expect(xml).toContain(
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  );
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(new Set(locs).size).toBe(locs.length);
  expect(locs).toEqual(INDEXABLE.map((path) => `${SITE}${path}`));
  // В sitemap нет карточек товаров и каталога (юридическое решение),
  // нет фиктивного lastmod.
  expect(xml).not.toContain("/product/");
  expect(xml).not.toContain("/catalog");
  expect(xml).not.toContain("<lastmod>");
});

test("файл подтверждения Яндекс Вебмастера: 200, точное содержимое", async ({
  request,
}) => {
  const response = await request.get("/yandex_637e4d2139cdf333.html");
  expect(response.status()).toBe(200);
  expect(response.url()).not.toMatch(/\/(yandex_[^/]+)\/$/); // без редиректа
  const body = await response.text();
  expect(body).toContain("<body>Verification: 637e4d2139cdf333</body>");
  expect(body.toLowerCase()).toContain("charset=utf-8");
});

test("информационные страницы: index, canonical, og, единственный robots", async ({
  request,
}) => {
  for (const path of INDEXABLE) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    // Ровно один meta robots и он — index (страница переопределяет
    // страховочный noindex из nuxt.config).
    const robots = robotsMetas(html);
    expect(robots, path).toHaveLength(1);
    expect(robots[0], path).toBe("index, follow");
    // Канонический абсолютный URL в punycode-форме, без query.
    expect(html, path).toContain('rel="canonical"');
    expect(html, path).toContain(`href="${SITE}${path === "/" ? "/" : path}"`);
    expect(html, path).toContain('property="og:url"');
    expect(html, path).toContain('property="og:title"');
    expect(html, path).toContain('property="og:locale" content="ru_RU"');
  }
});

test("каталог, поиск, кабинет и резерв: noindex без исключений", async ({
  request,
}) => {
  for (const path of NOINDEX) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    const robots = robotsMetas(html);
    expect(robots, path).toHaveLength(1);
    // Форма noindex зависит от того, рендерится ли страница без гейта:
    // «noindex, follow» — публичные маршруты (кабинет), «noindex, nofollow»
    // — страховочный дефолт для гейтируемых (каталог, поиск, резерв).
    expect(robots[0], path).toMatch(/^noindex/);
  }
});

test("JSON-LD: валидный JSON, ожидаемые типы, без Product/Offer", async ({
  request,
}) => {
  const check = async (path: string, expectTypes: string[]) => {
    const html = await (await request.get(path)).text();
    const blocks = [
      ...html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      ),
    ];
    expect(blocks.length, path).toBeGreaterThan(0);
    const parsed = blocks.map((m) => JSON.parse(m[1]));
    const types = parsed.map((node) => node["@type"]);
    for (const type of expectTypes)
      expect(types, `${path}: ${types.join()}`).toContain(type);
    for (const node of parsed) {
      const serialized = JSON.stringify(node).toLowerCase();
      expect(serialized, path).not.toContain('"product"');
      expect(serialized, path).not.toContain('"offer"');
      expect(serialized, path).not.toContain('"aggregaterating"');
    }
    return parsed;
  };
  await check("/", ["Organization", "WebSite"]);
  await check("/about", ["Organization", "BreadcrumbList"]);
  const storeNodes = await check("/stores", ["Organization", "Store"]);
  // Все точки сети — с адресом, городом и телефоном.
  const stores = storeNodes.filter((node) => node["@type"] === "Store");
  expect(stores.length).toBeGreaterThanOrEqual(30);
  for (const store of stores) {
    expect(store.address.addressLocality).toMatch(/Саратов|Энгельс|Москва/);
    expect(store.address.addressCountry).toBe("RU");
    expect(store.telephone).toContain("+7");
  }
});

test("404 для несуществующих категорий и товаров без age cookie", async ({
  request,
}) => {
  // До фикса validate() такие маршруты отвечали 200 (мягкий 404):
  // layout не рендерит слот, createError в странице не срабатывает.
  expect((await request.get("/catalog/nonexistent")).status()).toBe(404);
  expect((await request.get("/product/nonexistent")).status()).toBe(404);
  expect((await request.get("/nonexistent")).status()).toBe(404);
});

test("SSR главной для краулеров: без витрины каталога, но с контентом", async ({
  request,
}) => {
  const html = await (await request.get("/")).text();
  // Юридический инвариант: имена товаров и карточки не отдаются в HTML
  // без подтверждения 18+.
  expect(html).not.toContain("product-card");
  expect(html).not.toContain("Подставка");
  // Информационные секции главной доступны без гейта.
  expect(html).toContain("Прохук");
  expect(html.toLowerCase()).toContain("<h1");
  expect(html).toContain("/stores");
});

test("заголовки безопасности не ослаблены (CSP c Метрикой)", async ({
  request,
}) => {
  const headers = (await (await request.get("/")).headers())[
    "content-security-policy"
  ];
  expect(headers).toContain("default-src 'self'");
  expect(headers).toContain("https://mc.yandex.ru");
});

test("в dev/e2e-режиме по умолчанию счётчик Метрики не грузится", async ({
  page,
}) => {
  test.skip(
    process.env.NUXT_PUBLIC_METRIKA_ENABLED === "1",
    "режим принудительной Метрики (см. tests/metrika.spec.ts)",
  );
  await page.goto("/");
  const scripts = await page.locator('script[src*="mc.yandex.ru"]').count();
  expect(scripts).toBe(0);
  expect(await page.evaluate(() => window.ym)).toBeUndefined();
});

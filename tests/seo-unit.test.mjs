import { test } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const { canonicalSiteUrl, INDEXABLE_ROUTES, SITE_HOST_PUNYCODE } = await jiti(
  "../shared/seo/site.ts",
);
const {
  organizationSchema,
  websiteSchema,
  storeSchemas,
  breadcrumbSchema,
  parseOpeningHours,
} = await jiti("../shared/seo/schema.ts");
const {
  resolveMetrika,
  sanitizeEventParams,
  ANALYTICS_EVENTS,
  ANALYTICS_EVENT_PARAMS,
  METRIKA_COUNTER_ID,
} = await jiti("../shared/analytics/metrika.ts");

// ---------------------------------------------------------------- URL/домен

test("punycode-домен стабилен и соответствует домену сайта", () => {
  assert.equal(SITE_HOST_PUNYCODE, "xn--j1ahceql.xn--p1ai");
  assert.equal(new URL("https://прохук.рф/").hostname, SITE_HOST_PUNYCODE);
});

test("canonicalSiteUrl: punycode, отсечение query/hash, без дублей", () => {
  assert.equal(canonicalSiteUrl("/"), "https://xn--j1ahceql.xn--p1ai/");
  assert.equal(
    canonicalSiteUrl("/about"),
    "https://xn--j1ahceql.xn--p1ai/about",
  );
  assert.equal(
    canonicalSiteUrl("/catalog?sort=newest"),
    "https://xn--j1ahceql.xn--p1ai/catalog",
  );
  assert.equal(
    canonicalSiteUrl("/stores#map"),
    "https://xn--j1ahceql.xn--p1ai/stores",
  );
  assert.equal(
    canonicalSiteUrl("about"),
    "https://xn--j1ahceql.xn--p1ai/about",
  );
});

test("INDEXABLE_ROUTES: только информационные страницы, без дублей", () => {
  assert.equal(new Set(INDEXABLE_ROUTES).size, INDEXABLE_ROUTES.length);
  for (const route of INDEXABLE_ROUTES) {
    assert.match(route, /^\/[a-z-]*$/);
    assert.ok(!route.startsWith("/catalog"));
    assert.ok(!route.startsWith("/product"));
    assert.ok(!route.startsWith("/api"));
    assert.ok(
      !["/login", "/register", "/account", "/search", "/reserve"].includes(
        route,
      ),
    );
  }
  assert.ok(INDEXABLE_ROUTES.includes("/"));
});

// ------------------------------------------------------------------- Schema

const contacts = {
  phone: "+7 (8452) 94-67-44",
  phoneHref: "tel:+78452946744",
  email: "prohooksar@mail.ru",
  vk: "https://vk.ru/prohook64",
  telegram: "https://t.me/prohooksar",
  instagram: "https://www.instagram.com/pro.hook.official/",
};

test("organizationSchema: только достоверные поля, без оценок и предложений", () => {
  const org = organizationSchema(contacts);
  assert.equal(org["@type"], "Organization");
  assert.equal(org.url, "https://xn--j1ahceql.xn--p1ai/");
  assert.equal(org.telephone, contacts.phone);
  assert.equal(org.sameAs.length, 3);
  const serialized = JSON.stringify(org);
  for (const banned of ["aggregateRating", "review", "offers", "price"])
    assert.ok(!serialized.toLowerCase().includes(banned.toLowerCase()));
});

test("websiteSchema: базовые поля", () => {
  const site = websiteSchema();
  assert.equal(site["@type"], "WebSite");
  assert.equal(site.inLanguage, "ru-RU");
});

test("storeSchemas: адрес/телефон/geo; часы только при точном совпадении", () => {
  const stores = [
    {
      id: "a",
      cityId: "saratov",
      name: "ул. Тестовая, 1",
      address: "ул. Тестовая, 1",
      hours: "Ежедневно, 10:00–22:00",
      coordinates: [46.0, 51.5],
    },
    { id: "b", cityId: "moscow", name: "Точка", address: "ул. Иная, 2" },
  ];
  const nodes = storeSchemas(stores, contacts);
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0]["@type"], "Store");
  assert.equal(nodes[0].openingHours, "Mo-Su 10:00-22:00");
  assert.equal(nodes[0].geo.latitude, 51.5);
  assert.equal(nodes[0].geo.longitude, 46.0);
  assert.equal(nodes[0].address.addressLocality, "Саратов");
  assert.equal(nodes[1].address.addressLocality, "Москва");
  assert.equal(nodes[1].openingHours, undefined);
  assert.equal(nodes[1].geo, undefined);
  assert.ok(!("priceRange" in nodes[0]));
});

test("parseOpeningHours: только однозначно распознаваемые форматы", () => {
  assert.equal(
    parseOpeningHours("Ежедневно, 10:00–22:00"),
    "Mo-Su 10:00-22:00",
  );
  assert.equal(parseOpeningHours("Пн–Пт 9:00–20:00"), null);
  assert.equal(parseOpeningHours(undefined), null);
  assert.equal(parseOpeningHours("по расписанию"), null);
});

test("breadcrumbSchema: позиции и URL", () => {
  const crumb = breadcrumbSchema([
    { label: "Главная", to: "/" },
    { label: "Магазины" },
  ]);
  assert.equal(crumb["@type"], "BreadcrumbList");
  assert.deepEqual(
    crumb.itemListElement.map((item) => item.position),
    [1, 2],
  );
  assert.equal(crumb.itemListElement[0].item, "https://xn--j1ahceql.xn--p1ai/");
  assert.equal(crumb.itemListElement[1].item, undefined);
});

// ----------------------------------------------------------------- Метрика

test("resolveMetrika: auto только prod на публичном домене", () => {
  assert.equal(
    resolveMetrika({
      setting: undefined,
      prod: true,
      hostname: "xn--j1ahceql.xn--p1ai",
    }),
    true,
  );
  assert.equal(
    resolveMetrika({
      setting: undefined,
      prod: false,
      hostname: "example.com",
    }),
    false,
  );
  assert.equal(
    resolveMetrika({ setting: undefined, prod: true, hostname: "127.0.0.1" }),
    false,
  );
  assert.equal(
    resolveMetrika({ setting: undefined, prod: true, hostname: "localhost" }),
    false,
  );
  assert.equal(
    resolveMetrika({ setting: "1", prod: false, hostname: "127.0.0.1" }),
    true,
  );
  assert.equal(
    resolveMetrika({ setting: "0", prod: true, hostname: "x.com" }),
    false,
  );
});

test("sanitizeEventParams: allowlist отрезает лишнее (защита ПД)", () => {
  assert.deepEqual(
    sanitizeEventParams("store_location_view", {
      storeId: "saratov-antonova-33",
      phone: "+79000000000",
      name: "Иван",
    }),
    { storeId: "saratov-antonova-33" },
  );
  assert.deepEqual(
    sanitizeEventParams("account_login_success", { password: "x" }),
    undefined,
  );
  assert.equal(
    sanitizeEventParams("catalog_technical_error", {
      scope: "products",
      status: 500,
    }).status,
    500,
  );
  // Обрезка сверхдлинных значений
  assert.equal(
    sanitizeEventParams("store_phone_click", { source: "a".repeat(200) }).source
      .length,
    64,
  );
});

test("события аналитики: фиксированный перечень без покупательной семантики", () => {
  assert.equal(METRIKA_COUNTER_ID, "113582832");
  for (const name of ANALYTICS_EVENTS) {
    assert.ok(!/purchase|order|buy|checkout|cart/i.test(name), name);
    assert.ok(ANALYTICS_EVENT_PARAMS[name] !== undefined, name);
  }
  // Параметры событий не могут содержать ПД-ключи
  for (const params of Object.values(ANALYTICS_EVENT_PARAMS)) {
    for (const key of params) {
      assert.ok(
        !/phone|name|email|password|birth|token|address/i.test(key),
        key,
      );
    }
  }
});

import { test, expect } from "@playwright/test";

// Юридические инварианты сайта: возрастной гейт не пропускает контент в
// SSR-HTML, запрещённые категории не публикуются, на страницах каталога нет
// лексики дистанционной продажи и стимулирования, юридические страницы
// доступны без подтверждения возраста.

test("catalog content is absent from server HTML until age is confirmed", async ({
  page,
  request,
}) => {
  const bare = await request.get("/");
  const html = await bare.text();
  expect(html).not.toContain("Подставка");
  expect(html).not.toContain("product-card");

  // request-фикстура не разделяет cookie контекста — передаём подтверждение
  // возраста заголовком.
  const allowed = await request.get("/", {
    headers: { cookie: "prohook-age-confirmed=true" },
  });
  const allowedHtml = await allowed.text();
  expect(allowedHtml).toContain("Подставка 01");
  await page.context().addCookies([
    {
      name: "prohook-age-confirmed",
      value: "true",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto("/");
  await expect(page.locator(".product-card").first()).toBeVisible();
});

test("banned and unclassified categories are never published; pouches are published as regulated", async ({
  request,
}) => {
  const meta = await (await request.get("/api/catalog/meta")).json();
  const names = meta.categories.map(
    (category: { name: string }) => category.name,
  );
  expect(names).not.toContain("НБС");
  expect(names).not.toContain("Ароматизаторы");
  // Паучи (подтверждено владельцем) публикуются как регулируемая категория.
  expect(names).toContain("Жевательный табак");
  const list = await (await request.get("/api/products?limit=24")).json();
  expect(list.total).toBe(5);
  const pouch = list.items.find(
    (item: { slug: string }) => item.slug === "chew-01",
  );
  expect(pouch).toBeTruthy();
  // Свободные описания регулируемых классов не публикуются.
  expect(pouch.description).toBe("");
  const banned = await request.get("/api/products/nbc-01");
  expect(banned.status()).toBe(404);
});

test("legal pages are reachable without the age gate", async ({ page }) => {
  for (const path of [
    "/privacy",
    "/personal-data",
    "/information",
    "/contacts",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("dialog", { name: "Вам уже исполнилось 18 лет?" }),
    ).not.toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.goto("/information");
  await expect(page.getByRole("heading", { name: /Продавец/ })).toBeVisible();
  await expect(page.getByText("644910846228").first()).toBeVisible();
  await expect(
    page
      .getByRole("link", { name: "Политика обработки персональных данных" })
      .first(),
  ).toBeVisible();
});

test("catalog pages contain no remote-sale or promotion vocabulary", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "prohook-age-confirmed",
      value: "true",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  // /reserve включён: список выбранных товаров и запрос на резерв не должны
  // использовать лексику дистанционной продажи.
  for (const path of ["/", "/catalog", "/product/stands-01", "/reserve"]) {
    await page.goto(path);
    const text = await page.locator("body").innerText();
    for (const word of [
      "Купить",
      "В корзину",
      "Заказать",
      "Оформить заказ",
      "Перейти к оплате",
      "Доставк",
      "Скидк",
      "Промокод",
      "Бонус",
      "Подарок за",
      "Успей",
      "Хит",
    ])
      expect(text, `${path}: «${word}»`).not.toContain(word);
  }
});

test("owner home address, adult-shop tagline and MoySklad captions are absent", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "prohook-age-confirmed",
      value: "true",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  for (const path of [
    "/",
    "/catalog",
    "/product/stands-01",
    "/information",
    "/privacy",
    "/personal-data",
    "/about",
    "/stores",
    "/contacts",
    "/partners",
    "/reserve",
    "/login",
    "/register",
  ]) {
    await page.goto(path);
    const text = await page.locator("body").innerText();
    // Домашний адрес владельца не публикуется нигде (решение владельца
    // 08.10.2026); строки «магазин для взрослых 18+» и подписи про МойСклад
    // убраны по требованию заказчика.
    for (const banned of [
      "Васильковская",
      "Васильевская",
      "410039",
      "Магазины для взрослых",
      "магазинов для взрослых",
      "Изображение товара из каталога МойСклад",
      "поступают из МойСклад",
    ])
      expect(text, `${path}: «${banned}»`).not.toContain(banned);
  }
});

test("security headers are present", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
});

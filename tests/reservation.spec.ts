import { test, expect, type Page } from "@playwright/test";

// Запрос на резерв: список выбранных товаров, форма, серверная валидация,
// идемпотентность и отсутствие утечек Telegram-секретов. Капча и Telegram
// отключены в e2e (нет ключей, см. playwright.config.ts); их логика покрыта
// tests/reservation.test.mjs.

const AGE_COOKIE = {
  name: "prohook-age-confirmed",
  value: "true",
  domain: "127.0.0.1",
  path: "/",
};
const STORE_COOKIE = {
  name: "prohook-store",
  value: "store-2",
  domain: "127.0.0.1",
  path: "/",
};

async function openGated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(
    () => {
      const root = document.getElementById("__nuxt");
      return !!root && "__vue_app__" in root;
    },
    undefined,
    { timeout: 15000 },
  );
}

test("selection list supports add, quantity, removal, clear and persistence", async ({
  page,
}) => {
  await page.context().addCookies([AGE_COOKIE, STORE_COOKIE]);
  await openGated(page, "/product/stands-01");
  await page.getByRole("button", { name: "Добавить в список" }).click();
  await expect(
    page.getByRole("button", { name: "Убрать из списка" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Список выбранных товаров, позиций: 1" }),
  ).toBeVisible();
  await openGated(page, "/product/notebooks-01");
  await page.getByRole("button", { name: "Добавить в список" }).click();

  await openGated(page, "/reserve");
  await expect(
    page.getByRole("heading", { name: "Список выбранных товаров" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Подставка 01" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Блокнот 01" })).toBeVisible();

  // Количество: + и −, состояние сохраняется между перезагрузками.
  const stepper = page.locator(".reserve-item", {
    has: page.getByRole("link", { name: "Подставка 01" }),
  });
  await stepper.getByRole("button", { name: "Увеличить количество" }).click();
  await expect(stepper.locator("output")).toHaveText("2");
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(
    page
      .locator(".reserve-item", {
        has: page.getByRole("link", { name: "Подставка 01" }),
      })
      .locator("output"),
  ).toHaveText("2");
  await expect(page.getByText("позиций: 2 · штук: 3")).toBeVisible();

  await stepper.getByRole("button", { name: "Уменьшить количество" }).click();
  await expect(stepper.locator("output")).toHaveText("1");
  await stepper.getByRole("button", { name: "Удалить" }).click();
  await expect(page.getByRole("link", { name: "Подставка 01" })).toHaveCount(0);
  await page.getByRole("button", { name: "Очистить список" }).click();
  await expect(page.getByText("Список пуст")).toBeVisible();
});

test("catalog cards add to the list and link to /reserve", async ({ page }) => {
  await page.context().addCookies([AGE_COOKIE, STORE_COOKIE]);
  await openGated(page, "/catalog");
  await page.getByRole("button", { name: "+ В список" }).first().click();
  const active = page.getByRole("link", { name: /В списке/ }).first();
  await expect(active).toBeVisible();
  await active.click();
  await expect(
    page.getByRole("heading", { name: "Список выбранных товаров" }),
  ).toBeVisible();
});

test("reserve form requires contacts, store and both consents", async ({
  page,
}) => {
  await page.context().addCookies([AGE_COOKIE, STORE_COOKIE]);
  await openGated(page, "/product/stands-01");
  await page.getByRole("button", { name: "Добавить в список" }).click();
  await openGated(page, "/reserve");
  await page
    .getByRole("button", { name: "Отправить запрос на резерв" })
    .click();
  await expect(page.getByLabel("Имя *", { exact: true })).toBeFocused();
  await page.getByLabel("Имя *", { exact: true }).fill("Иван Резерров");
  await page.getByLabel("Телефон *").fill("+7 999 123-45-67");
  await page
    .getByRole("button", { name: "Отправить запрос на резерв" })
    .click();
  await expect(
    page.getByText("Подтвердите согласие на обработку персональных данных."),
  ).toBeVisible();
  await expect(
    page.getByText("Подтвердите согласие на передачу запроса через Telegram."),
  ).toBeVisible();
});

test("reserve form submits and shows the public request id", async ({
  page,
}) => {
  await page.context().addCookies([AGE_COOKIE, STORE_COOKIE]);
  await openGated(page, "/product/stands-01");
  await page.getByRole("button", { name: "Добавить в список" }).click();
  await openGated(page, "/reserve");
  await page.getByLabel("Имя *", { exact: true }).fill("Иван Резерров");
  await page.getByLabel("Телефон *").fill("+7 999 123-45-67");
  await page.getByLabel("Комментарий (необязательно)").fill("Приду вечером");
  const consents = page.getByRole("checkbox");
  await consents.nth(0).check();
  await consents.nth(1).check();
  await page
    .getByRole("button", { name: "Отправить запрос на резерв" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Запрос на резерв отправлен" }),
  ).toBeVisible();
  await expect(page.getByText(/R-[A-HJ-NP-Z2-9]{6}/).first()).toBeVisible();
  // Список очищен после успешной отправки.
  await expect(
    page.getByRole("link", { name: "Список выбранных товаров, позиций:" }),
  ).toHaveCount(0);
});

test("server re-validates store, products, stock and consents", async ({
  request,
}) => {
  const payload = {
    name: "Иван Резерров",
    phone: "+7 999 123-45-67",
    storeId: "store-2",
    comment: "",
    consent: true,
    consentTelegram: true,
    items: [{ productId: "p1", quantity: 1 }],
  };
  const post = (data: unknown, headers: Record<string, string> = {}) =>
    request.post("/api/reservations", { data, headers });

  // Несуществующий магазин.
  const unknownStore = await post({ ...payload, storeId: "store-99" });
  expect(unknownStore.status()).toBe(422);
  expect(((await unknownStore.json()).data?.errors ?? {}).storeId).toBeTruthy();

  // Подменённый productId: товар скрыт юридической политикой.
  const bannedProduct = await post({
    ...payload,
    items: [{ productId: "p7", quantity: 1 }],
  });
  expect(bannedProduct.status()).toBe(422);
  expect(((await bannedProduct.json()).data?.errors ?? {}).items).toContain(
    "не доступен на сайте",
  );

  // Подменённое количество: лимит на позицию проверяется явно, без
  // молчаливого урезания.
  const tooMany = await post({
    ...payload,
    items: [{ productId: "p1", quantity: 50 }],
  });
  expect(tooMany.status()).toBe(422);
  expect(((await tooMany.json()).data?.errors ?? {}).items).toContain(
    "Максимум 10 шт. одного товара",
  );

  // Недостаточный остаток: stands-01 в store-3 «мало» (бакет ≤ 3 шт.).
  const lowStock = await post({
    ...payload,
    storeId: "store-3",
    items: [{ productId: "p1", quantity: 5 }],
  });
  expect(lowStock.status()).toBe(422);
  expect(((await lowStock.json()).data?.errors ?? {}).items).toContain(
    "доступно к резерву 3 шт.",
  );

  // Нет в наличии: stands-01 в store-1 недоступен (фикстура).
  const unavailable = await post({ ...payload, storeId: "store-1" });
  expect(unavailable.status()).toBe(422);
  expect(((await unavailable.json()).data?.errors ?? {}).items).toContain(
    "нет в наличии",
  );

  // Согласия обязательны по отдельности.
  const noConsent = await post({ ...payload, consent: false });
  expect(noConsent.status()).toBe(422);
  expect(Object.keys((await noConsent.json()).data?.errors ?? {})).toContain(
    "consent",
  );

  // Honeypot.
  const trapped = await post({ ...payload, website: "http://spam.example" });
  expect(trapped.status()).toBe(400);

  // Cross-site и не-JSON запросы отбрасываются guard-ом.
  const crossSite = await request.post("/api/reservations", {
    data: payload,
    headers: { "sec-fetch-site": "cross-site" },
  });
  expect(crossSite.status()).toBe(403);
  const plain = await request.post("/api/reservations", {
    data: "not-json",
    headers: { "content-type": "text/plain" },
  });
  expect(plain.status()).toBe(415);
});

test("idempotency: the same key returns the same request without duplicates", async ({
  request,
}) => {
  const payload = {
    name: "Иван Резерров",
    phone: "+7 999 123-45-67",
    storeId: "store-2",
    comment: "",
    consent: true,
    consentTelegram: true,
    items: [{ productId: "p1", quantity: 1 }],
  };
  const key = `e2e-key-${Date.now()}`;
  const first = await request.post("/api/reservations", {
    data: payload,
    headers: { "Idempotency-Key": key },
  });
  expect(first.status()).toBe(200);
  const firstBody = await first.json();
  expect(firstBody.publicId).toMatch(/^R-/);
  expect(firstBody.replayed).toBeUndefined();
  // double-submit/retry: тот же ключ — тот же запрос.
  const second = await request.post("/api/reservations", {
    data: payload,
    headers: { "Idempotency-Key": key },
  });
  expect(second.status()).toBe(200);
  expect(await second.json()).toMatchObject({
    ok: true,
    publicId: firstBody.publicId,
    replayed: true,
  });
  // Другой ключ — другой запрос.
  const third = await request.post("/api/reservations", {
    data: payload,
    headers: { "Idempotency-Key": `${key}-next` },
  });
  expect((await third.json()).publicId).not.toBe(firstBody.publicId);
});

test("authenticated minors cannot submit reservation requests", async ({
  request,
}) => {
  const suffix = String(Date.now()).slice(-7);
  const phone = `+7 (999) ${suffix.slice(0, 3)}-${suffix.slice(3, 5)}-${suffix.slice(5)}`;
  const birthYear = new Date().getFullYear() - 16;
  const registration = await request.post("/api/auth/register", {
    data: {
      lastName: "Несовершеннолетний",
      firstName: "Иван",
      middleName: "Иванович",
      dateOfBirth: `01.01.${birthYear}`,
      phone,
      password: "secret123",
      passwordConfirm: "secret123",
      consent: true,
    },
  });
  expect(registration.status()).toBe(200);
  // Cookie сессии из ответа переносим в API-запрос резервации.
  const setCookie = registration.headers()["set-cookie"] ?? "";
  const sessionToken = /prohook-session=([^;]+)/.exec(setCookie)?.[1];
  expect(sessionToken).toBeTruthy();
  const response = await request.post("/api/reservations", {
    data: {
      name: "Иван Несовершеннолетний",
      phone,
      storeId: "store-2",
      comment: "",
      consent: true,
      consentTelegram: true,
      items: [{ productId: "p1", quantity: 1 }],
    },
    headers: { cookie: `prohook-session=${sessionToken}` },
  });
  expect(response.status()).toBe(403);
});

test("no telegram secrets or chat ids reach the browser", async ({
  request,
}) => {
  const secrets = [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_RESERVATION_CHAT_IDS",
    "SMARTCAPTCHA_SERVER_KEY",
    "api.telegram.org/bot",
    "6939112736",
    "1107248048",
    "5313920922",
    "8562692667",
  ];
  const html = await (
    await request.get("/reserve", {
      headers: { cookie: "prohook-age-confirmed=true" },
    })
  ).text();
  for (const secret of secrets)
    expect(html, `page: ${secret}`).not.toContain(secret);
  // Клиентские чанки собираются из кода без серверных env-переменных.
  const scripts = [...html.matchAll(/src="(\/_nuxt\/[^"]+\.js)"/g)].map(
    (match) => match[1],
  );
  expect(scripts.length).toBeGreaterThan(0);
  for (const src of scripts) {
    const js = await (await request.get(src)).text();
    for (const secret of secrets)
      expect(js, `${src}: ${secret}`).not.toContain(secret);
  }
});

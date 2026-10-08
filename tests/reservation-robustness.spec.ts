import { test, expect, type Page } from "@playwright/test";

// Устойчивость списка выбранных товаров и API запроса на резерв к битым
// данным и злоупотреблениям. Фикстура содержит stockDetail, поэтому эти
// тесты проверяют путь ТОЧНЫХ остатков (а не только бакетов наличия).

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

function selectionCookie(entries: unknown) {
  return {
    name: "prohook-selection",
    value: JSON.stringify(entries),
    domain: "127.0.0.1",
    path: "/",
  };
}

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

test("corrupted selection cookie never breaks the page", async ({ page }) => {
  for (const value of [
    "not-json{{{",
    '[{"productId":"p1","quantity"',
    "null",
    "42",
  ]) {
    await page.context().clearCookies();
    await page
      .context()
      .addCookies([
        AGE_COOKIE,
        STORE_COOKIE,
        { ...selectionCookie([]), value },
      ]);
    await openGated(page, "/reserve");
    await expect(
      page.getByRole("heading", { name: "Список выбранных товаров" }),
    ).toBeVisible();
    await expect(page.getByText("Список пуст")).toBeVisible();
  }
});

test("hostile selection cookie is sanitized to valid entries", async ({
  page,
}) => {
  await page.context().addCookies([
    AGE_COOKIE,
    STORE_COOKIE,
    selectionCookie([
      { productId: "p1", quantity: 7 },
      { productId: "p1", quantity: 2 }, // дубль — игнорируется
      { bad: true }, // мусор — отброшен
      { productId: "x!", quantity: 1 }, // недопустимый id — отброшен
      { productId: "p3", quantity: 3 }, // в пределах точного остатка store-2
      { productId: 42, quantity: 1 }, // не строка — отброшен
      "мусор",
      null,
    ]),
  ]);
  await openGated(page, "/reserve");
  await expect(page.getByText("позиций: 2 · штук: 10")).toBeVisible();
  await expect(page.getByRole("link", { name: "Подставка 01" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Блокнот 01" })).toBeVisible();
  // Список кликабелен и отправляется после санитизации.
  await page.getByLabel("Имя *", { exact: true }).fill("Иван Санитизин");
  await page.getByLabel("Телефон *").fill("+7 999 000-00-00");
  const consents = page.getByRole("checkbox");
  await consents.nth(0).check();
  await consents.nth(1).check();
  await page
    .getByRole("button", { name: "Отправить запрос на резерв" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Запрос на резерв отправлен" }),
  ).toBeVisible();
});

test("oversized cookie (30 items) is capped to the first 20", async ({
  page,
}) => {
  await page.context().addCookies([
    AGE_COOKIE,
    STORE_COOKIE,
    selectionCookie(
      Array.from({ length: 30 }, (_, i) => ({
        productId: `bulk-${i}`,
        quantity: 1,
      })),
    ),
  ]);
  await openGated(page, "/reserve");
  // Позиции-призраки не находятся в каталоге: страница не падает,
  // счётчик ограничен 20, каждая строка предлагает удаление.
  await expect(page.getByText("позиций: 20")).toBeVisible();
  const removeButtons = page.getByRole("button", { name: "Удалить" });
  await expect(removeButtons).toHaveCount(20);
  await expect(page.locator(".reserve-item--issue")).toHaveCount(20);
});

test("stale product in the list blocks submit and can be removed", async ({
  page,
}) => {
  await page
    .context()
    .addCookies([
      AGE_COOKIE,
      STORE_COOKIE,
      selectionCookie([{ productId: "ghost-01", quantity: 2 }]),
    ]);
  await openGated(page, "/reserve");
  await expect(
    page.getByText(
      "Товар больше не доступен на сайте — удалите его из списка.",
    ),
  ).toBeVisible();
  const submit = page.getByRole("button", {
    name: "Отправить запрос на резерв",
  });
  await expect(submit).toBeDisabled();
  await page.getByRole("button", { name: "Удалить" }).click();
  // Форма скрыта вместе с пустым списком — остаётся пустое состояние.
  await expect(page.getByText("Список пуст")).toBeVisible();
  await expect(submit).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Перейти в каталог" }),
  ).toBeVisible();
});

test("stepper: minus at 1 removes the item, plus at 10 is disabled", async ({
  page,
}) => {
  await page
    .context()
    .addCookies([
      AGE_COOKIE,
      STORE_COOKIE,
      selectionCookie([{ productId: "p1", quantity: 10 }]),
    ]);
  await openGated(page, "/reserve");
  const row = page.locator(".reserve-item", {
    has: page.getByRole("link", { name: "Подставка 01" }),
  });
  await expect(
    row.getByRole("button", { name: "Увеличить количество" }),
  ).toBeDisabled();
  await row.getByRole("button", { name: "Уменьшить количество" }).click();
  await expect(row.locator("output")).toHaveText("9");
  // Единственная позиция с количеством 1 удаляется кнопкой «−».
  await selectionHelper(page, "p1", 1);
  await openGated(page, "/reserve");
  const single = page.locator(".reserve-item", {
    has: page.getByRole("link", { name: "Подставка 01" }),
  });
  await single.getByRole("button", { name: "Уменьшить количество" }).click();
  await expect(page.getByText("Список пуст")).toBeVisible();
});

async function selectionHelper(
  page: Page,
  productId: string,
  quantity: number,
) {
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      AGE_COOKIE,
      STORE_COOKIE,
      selectionCookie([{ productId, quantity }]),
    ]);
}

test("double-click submit sends exactly one request", async ({ page }) => {
  await page
    .context()
    .addCookies([
      AGE_COOKIE,
      STORE_COOKIE,
      selectionCookie([{ productId: "p1", quantity: 1 }]),
    ]);
  await openGated(page, "/reserve");
  await page.getByLabel("Имя *", { exact: true }).fill("Иван Даблкликов");
  await page.getByLabel("Телефон *").fill("+7 999 111-11-11");
  const consents = page.getByRole("checkbox");
  await consents.nth(0).check();
  await consents.nth(1).check();
  let posts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/api/reservations")
    )
      posts++;
  });
  // Три клика в один тик (синтетические события обходят ожидания
  // доступности Playwright на кнопке, уходящей в loading).
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((item) =>
      item.textContent?.includes("Отправить запрос на резерв"),
    );
    for (let index = 0; index < 3; index++)
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await expect(
    page.getByRole("heading", { name: "Запрос на резерв отправлен" }),
  ).toBeVisible();
  expect(posts).toBe(1);
  // Экран успеха не содержит лексики состоявшейся покупки.
  const successText = await page.locator(".reserve-success").innerText();
  for (const forbidden of [
    "Спасибо за покупку",
    "Заказ оформлен",
    "Оплата прошла",
    "куплен",
  ])
    expect(successText, forbidden).not.toContain(forbidden);
});

test("exact stock beats availability bucket on the server", async ({
  request,
}) => {
  const payload = {
    name: "Иван Точный",
    phone: "+7 999 222-22-22",
    storeId: "store-2",
    comment: "",
    consent: true,
    consentTelegram: true,
  };
  // p2 в store-2: бакет «Мало» разрешил бы 3 шт., точный остаток 2 →
  // сервер обязан отказать в 3 шт. (точные данные бьют бакет).
  const over = await request.post("/api/reservations", {
    data: { ...payload, items: [{ productId: "p2", quantity: 3 }] },
  });
  expect(over.status()).toBe(422);
  expect(((await over.json()).data?.errors ?? {}).items).toContain(
    "доступно к резерву 2 шт.",
  );
  const exact = await request.post("/api/reservations", {
    data: { ...payload, items: [{ productId: "p2", quantity: 2 }] },
  });
  expect(exact.status()).toBe(200);
  // Точный остаток в пределах лимита позиции не мешает (p4: 6 шт.).
  const fine = await request.post("/api/reservations", {
    data: { ...payload, items: [{ productId: "p4", quantity: 3 }] },
  });
  expect(fine.status()).toBe(200);
  // Точный остаток выше лимита позиции (12 > 10) ограничивается лимитом.
  const clamped = await request.post("/api/reservations", {
    data: { ...payload, items: [{ productId: "p1", quantity: 10 }] },
    headers: { "Idempotency-Key": `robust-${Date.now()}` },
  });
  expect(clamped.status()).toBe(200);
  // Товар без оффера в выбранном магазине (p5 продаётся только в store-3).
  const noOffer = await request.post("/api/reservations", {
    data: { ...payload, items: [{ productId: "p5", quantity: 1 }] },
  });
  expect(noOffer.status()).toBe(422);
  expect(((await noOffer.json()).data?.errors ?? {}).items).toContain(
    "не представлен в выбранном магазине",
  );
});

test("API rejects malformed bodies, sizes and wrong methods", async ({
  request,
}) => {
  const payload = {
    name: "Иван Точный",
    phone: "+7 999 222-22-22",
    storeId: "store-2",
    comment: "",
    consent: true,
    consentTelegram: true,
    items: [{ productId: "p1", quantity: 1 }],
  };
  // GET не поддерживается (только POST-эндпоинт; Nitro отвечает 404/405).
  expect([404, 405]).toContain(
    (await request.get("/api/reservations")).status(),
  );
  // Тело больше 8 КБ отбрасывается до валидации.
  const huge = await request.post("/api/reservations", {
    data: { ...payload, comment: "x".repeat(9000) },
  });
  expect(huge.status()).toBe(413);
  // Не-объектные JSON-тела (null без тела уходит в 415 «JSON required»).
  for (const data of [null, [], "строка", 42, true]) {
    const response = await request.post("/api/reservations", { data });
    expect([415, 422]).toContain(response.status());
  }
  // Некорректный Idempotency-Key игнорируется — запрос создаётся обычным
  // путём (ключ слишком короткий).
  const badKey = await request.post("/api/reservations", {
    data: payload,
    headers: { "Idempotency-Key": "short" },
  });
  expect(badKey.status()).toBe(200);
  expect((await badKey.json()).replayed).toBeUndefined();
  // Поле captchaToken без настроенной капчи не влияет на результат.
  const withToken = await request.post("/api/reservations", {
    data: { ...payload, captchaToken: "leftover-token" },
  });
  expect(withToken.status()).toBe(200);
});

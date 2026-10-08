import { test, expect, type Page } from "@playwright/test";

// Уникальные телефоны на прогон: файловое хранилище аккаунтов переживает
// перезапуски dev-сервера в пределах тестового каталога. Случайный старт
// обязателен: параллельные воркеры, засеянные от Date.now() в одну
// миллисекунду, порождали коллизии телефонов и ложные 409.
let phoneSeed = 70000000000 + Math.floor(Math.random() * 9998900000);
function uniquePhone() {
  phoneSeed += 137;
  const digits = String(phoneSeed);
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
}

const ADULT = "01.01.2000";
// Дата рождения «ровно 18 сегодня» и «17 лет 364 дня».
function birthdayExact18(): string {
  const today = new Date();
  const iso = new Date(
    Date.UTC(today.getFullYear() - 18, today.getMonth(), today.getDate()),
  )
    .toISOString()
    .slice(0, 10);
  return iso.split("-").reverse().join(".");
}
function birthdayUnder18(): string {
  const today = new Date();
  const iso = new Date(
    Date.UTC(today.getFullYear() - 17, today.getMonth(), today.getDate() - 1),
  )
    .toISOString()
    .slice(0, 10);
  return iso.split("-").reverse().join(".");
}

// На открытых маршрутах нет AgeGate-диалога, который в других тестах
// неявно ждёт hydration. В dev-режиме чанки страницы компилируются при
// первом заходе — без ожидания submit уйдёт в нативный GET до монтирования
// Vue (и унесёт пароль в URL). Ждём детерминированный маркер hydration.
async function openAuthPage(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(
    () => {
      const root = document.getElementById("__nuxt");
      // __vue_app__ появляется только в app.mount() — после этого
      // слушатели формы живы. window.useNuxtApp существует раньше и
      // не годится как маркер.
      return !!root && "__vue_app__" in root;
    },
    undefined,
    { timeout: 15000 },
  );
}

async function register(page: Page, overrides: Record<string, string> = {}) {
  const phone = overrides.phone ?? uniquePhone();
  const dateOfBirth = overrides.dateOfBirth ?? ADULT;
  await openAuthPage(page, "/register");
  await page.getByLabel("Фамилия").fill(overrides.lastName ?? "Иванов");
  await page
    .getByLabel("Имя", { exact: true })
    .fill(overrides.firstName ?? "Иван");
  await page.getByLabel("Отчество").fill(overrides.middleName ?? "Иванович");
  // Поле принимает дату одним непрерывным вводом: 15062008 → 15.06.2008.
  await page
    .getByLabel("Дата рождения", { exact: true })
    .fill(dateOfBirth.replace(/\D/g, ""));
  await page.getByLabel("Телефон", { exact: true }).fill(phone);
  await page
    .getByLabel("Пароль", { exact: true })
    .fill(overrides.password ?? "secret123");
  await page
    .getByLabel("Подтверждение пароля")
    .fill(overrides.passwordConfirm ?? overrides.password ?? "secret123");
  await page.getByLabel(/Согласен\(на\) на обработку/).check();
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  return { phone, dateOfBirth };
}

async function login(page: Page, phone: string, password: string) {
  await openAuthPage(page, "/login");
  await page.getByLabel("Телефон", { exact: true }).fill(phone);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
}

async function confirmAge(page: Page, path = "/catalog") {
  await page.context().clearCookies({ name: "prohook-age-confirmed" });
  await page.goto(path);
  await page.getByRole("button", { name: "Мне 18 лет или больше" }).click();
}

test("registration creates a session and opens the account", async ({
  page,
}) => {
  const { phone } = await register(page);
  await expect(page).toHaveURL(/\/account$/, { timeout: 15000 });
  await expect(
    page.getByRole("heading", { name: "Личный кабинет" }),
  ).toBeVisible();
  await expect(page.locator(".account-greeting")).toContainText("Иван");
  await expect(page.locator(".account-greeting")).toContainText("Иванов");
  // В шапке — вход в кабинет.
  await expect(page.locator(".account-link")).toContainText("Личный кабинет");
  // Cookie сессии — HttpOnly.
  const session = (await page.context().cookies()).find(
    (cookie) => cookie.name === "prohook-session",
  );
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
  const normalized = phone.replace(/\D/g, "");
  // Личные данные показывают нормализованный телефон в читаемом виде.
  await expect(page.locator(".account-profile")).toContainText(
    `+7 ${normalized.slice(1, 4)} ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9)}`,
  );
});

test("session survives page reload", async ({ page }) => {
  const { phone } = await register(page);
  // Клиентская навигация после submit асинхронна — ждём /account,
  // иначе reload перезагрузит ещё /register.
  await expect(page).toHaveURL(/\/account$/, { timeout: 15000 });
  await page.reload();
  await expect(page.locator(".account-greeting")).toContainText("Иван");
  const me = await page.request.get("/api/auth/me");
  expect((await me.json()).user?.phone).toBe(phone.replace(/\D/g, ""));
});

test("registration validates required fields", async ({ page }) => {
  await openAuthPage(page, "/register");
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await expect(page.getByText("Укажите фамилию.")).toBeVisible();
  await expect(page.getByText("Укажите имя.")).toBeVisible();
  await expect(page.getByText("Укажите отчество.")).toBeVisible();
  await expect(
    page.getByText("Укажите дату рождения: ДД.ММ.ГГГГ."),
  ).toBeVisible();
  await expect(
    page.getByText("Укажите телефон в формате +7 (999) 123-45-67."),
  ).toBeVisible();
  await expect(
    page.getByText("Пароль должен содержать минимум 8 символов."),
  ).toBeVisible();
  await expect(
    page.getByText("Подтвердите согласие на обработку персональных данных."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test("registration rejects bad phone, weak password, mismatch and future date", async ({
  page,
}) => {
  await register(page, { phone: "12345" });
  await expect(
    page.getByText("Укажите телефон в формате +7 (999) 123-45-67."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);

  await register(page, { password: "short", passwordConfirm: "short" });
  await expect(
    page.getByText("Пароль должен содержать минимум 8 символов."),
  ).toBeVisible();

  await register(page, { passwordConfirm: "different1" });
  await expect(page.getByText("Пароли не совпадают.")).toBeVisible();

  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  await register(page, {
    dateOfBirth: nextYear
      .toISOString()
      .slice(0, 10)
      .split("-")
      .reverse()
      .join("."),
  });
  await expect(
    page.getByText("Дата рождения не может быть в будущем."),
  ).toBeVisible();
});

test("duplicate phone is rejected without account enumeration", async ({
  page,
}) => {
  const { phone } = await register(page);
  await expect(page).toHaveURL(/\/account$/, { timeout: 15000 });
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await register(page, { phone });
  await expect(
    page.getByText("Регистрация с этим номером недоступна"),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test("login with correct and wrong password", async ({ page }) => {
  const { phone } = await register(page);
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await login(page, phone, "wrong-password");
  await expect(page.getByText("Неверный телефон или пароль.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  await login(page, phone, "secret123");
  await expect(page).toHaveURL(/\/account$/, { timeout: 15000 });
  await expect(page.locator(".account-greeting")).toContainText("Иван");
});

test("logout clears the session client and server side", async ({ page }) => {
  await register(page);
  const token = (await page.context().cookies()).find(
    (cookie) => cookie.name === "prohook-session",
  )?.value;
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator(".account-link")).toContainText("Войти");
  // Старый токен отклонён сервером даже при ручной подстановке.
  const me = await page.request.get("/api/auth/me", {
    headers: { cookie: `prohook-session=${token}` },
  });
  expect((await me.json()).user).toBeNull();
  // /account снова показывает приглашение войти.
  await page.goto("/account");
  await expect(
    page.getByText("Войдите, чтобы получить доступ к личному кабинету."),
  ).toBeVisible();
});

test("account page is protected for anonymous visitors", async ({ page }) => {
  await page.goto("/account");
  await expect(
    page.getByText("Войдите, чтобы получить доступ к личному кабинету."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Выйти" })).toHaveCount(0);
  const loyalty = await page.request.get("/api/account/loyalty");
  expect(loyalty.status()).toBe(401);
});

test("loyalty block reports unavailability when Teyca is not configured", async ({
  page,
}) => {
  test.slow();
  await register(page);
  await expect(page).toHaveURL(/\/account$/, { timeout: 15000 });
  await expect(
    page.getByText(
      "Не удалось загрузить информацию о бонусах. Попробуйте позже.",
    ),
  ).toBeVisible({ timeout: 15000 });
  const retry = page.getByRole("button", { name: "Повторить" });
  // Под параллельной загрузкой dev-сервера дозапрос бонусов может
  // задержаться дольше стандартных 5 секунд.
  await expect(retry).toBeVisible({ timeout: 15000 });
  await retry.click();
  await expect(
    page.getByText(
      "Не удалось загрузить информацию о бонусах. Попробуйте позже.",
    ),
  ).toBeVisible();
});

test("loyalty block shows balance, level and discount from Teyca", async ({
  page,
}) => {
  // Ответ Тейка подменяется на маршруте: проверяется отображение
  // баланса без доступа к реальному API.
  await page.route("**/api/account/loyalty", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        balance: 1250,
        loyaltyLevel: "Серебряный",
        discount: "5%",
      }),
    });
  });
  await register(page);
  await expect(page).toHaveURL(/\/account$/, { timeout: 15000 });
  await expect(page.locator(".account-bonus")).toContainText("1250", {
    timeout: 15000,
  });
  await expect(page.locator(".account-bonus span")).toHaveText("бонусов");
  await expect(page.getByText("Серебряный")).toBeVisible();
  await expect(page.getByText("Скидка по карте: 5%")).toBeVisible();
});

test("loyalty block explains a missing Teyca card without retry", async ({
  page,
}) => {
  await page.route("**/api/account/loyalty", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "unlinked",
        message:
          "Бонусная карта пока не привязана. Получите карту Прохук в магазине.",
      }),
    });
  });
  await register(page);
  await expect(page).toHaveURL(/\/account$/, { timeout: 15000 });
  await expect(
    page.getByText("Бонусная карта пока не привязана", { exact: false }),
  ).toBeVisible({ timeout: 15000 });
  // Это не ошибка — кнопки повтора быть не должно.
  await expect(page.getByRole("button", { name: "Повторить" })).toHaveCount(0);
});

test("loyalty block survives an expired session", async ({ page }) => {
  await page.route("**/api/account/loyalty", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json" });
  });
  await register(page);
  await expect(page).toHaveURL(/\/account$/, { timeout: 15000 });
  await expect(
    page.getByText("Сессия истекла. Войдите заново, чтобы увидеть бонусы."),
  ).toBeVisible({ timeout: 15000 });
});

test("anonymous catalog hides product images server-side", async ({
  request,
}) => {
  const list = await (await request.get("/api/products?limit=5")).json();
  expect(list.items.length).toBeGreaterThan(0);
  for (const product of list.items) {
    expect(product.images).toEqual([]);
    expect(product.imagesRestricted).toBe(true);
  }
  const meta = await (await request.get("/api/catalog/meta")).json();
  for (const category of meta.categories)
    expect(category.image).toBeUndefined();
  // Прямой URL изображения недоступен без сессии совершеннолетнего.
  const image = await request.get(`/api/products/${list.items[0].id}/images/0`);
  expect(image.status()).toBe(403);
});

test("adult session unlocks product images", async ({ page }) => {
  await register(page, { dateOfBirth: birthdayExact18() });
  await expect(page).toHaveURL(/\/account$/, { timeout: 15000 });
  const list = await (await page.request.get("/api/products?limit=5")).json();
  const pictured = list.items.find(
    (product: { images: unknown[] }) => product.images.length > 0,
  );
  expect(pictured).toBeTruthy();
  expect(pictured.imagesRestricted).toBeUndefined();
  // Страница товара рендерит галерею с изображениями.
  await confirmAge(page, `/product/${pictured.slug}`);
  await expect(page.locator(".product-gallery img").first()).toBeVisible();
  await expect(page.locator(".image-placeholder--restricted")).toHaveCount(0);
  // Прямой URL проходит возрастной гейт (дальше — МойСклад, 502 в тестах).
  const image = await page.request.get(`/api/products/${pictured.id}/images/0`);
  expect(image.status()).not.toBe(403);
});

test("under-18 account keeps catalog text but never images", async ({
  page,
}) => {
  await register(page, { dateOfBirth: birthdayUnder18() });
  await expect(page).toHaveURL(/\/account$/, { timeout: 15000 });
  await expect(
    page.getByText(
      "Изображения товаров доступны только совершеннолетним пользователям.",
    ),
  ).toBeVisible();
  const list = await (await page.request.get("/api/products?limit=5")).json();
  expect(list.items[0].images).toEqual([]);
  expect(list.items[0].imagesRestricted).toBe(true);
  const image = await page.request.get(
    `/api/products/${list.items[0].id}/images/0`,
  );
  expect(image.status()).toBe(403);
  // Каталог по-прежнему читаем: текст и цены на месте.
  await confirmAge(page, "/catalog");
  await expect(page.locator(".product-card").first()).toBeVisible();
  await expect(
    page.locator(".image-placeholder--restricted").first(),
  ).toBeVisible();
});

test("register and login forms work on mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { phone } = await register(page, { firstName: "Пётр" });
  await expect(page).toHaveURL(/\/account$/, { timeout: 15000 });
  await expect(page.locator(".account-greeting")).toContainText("Пётр");
  // Иконка аккаунта в шапке доступна без горизонтальной прокрутки.
  const link = page.locator(".account-link");
  await expect(link).toBeVisible();
  await expect(await link.boundingBox()).toBeTruthy();
  await page.getByRole("button", { name: "Выйти" }).click();
  await login(page, phone, "secret123");
  await expect(page).toHaveURL(/\/account$/, { timeout: 15000 });
});

test("auth endpoints reject cross-site and non-JSON requests", async ({
  request,
}) => {
  const crossSite = await request.post("/api/auth/login", {
    headers: {
      "sec-fetch-site": "cross-site",
      "content-type": "application/json",
    },
    data: { phone: "79991234567", password: "whatever1" },
  });
  expect(crossSite.status()).toBe(403);
  const notJson = await request.post("/api/auth/login", {
    headers: { "content-type": "text/plain" },
    data: "x",
  });
  expect(notJson.status()).toBe(415);
  // Некорректный JSON проверяется на уровне JSON.parse в guardJsonRequest
  // (см. unit-паттерн partnership); транспорт Playwright экранирует строку.
});

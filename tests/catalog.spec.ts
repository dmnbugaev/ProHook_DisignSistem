import { test, expect, type Page } from "@playwright/test";

// Подтверждение 18+ сохраняется в cookie на год. Для детерминизма тестов
// чистим cookie перед каждым заходом. Информационные страницы (/, /about,
// /stores, /partners) гейт не показывают: подтверждаем возраст на каталоге
// и переходим на целевую страницу.
async function open(page: Page, path = "/catalog") {
  await page.context().clearCookies({ name: "prohook-age-confirmed" });
  await page.goto("/catalog");
  await page.getByRole("button", { name: "Мне 18 лет или больше" }).click();
  if (path !== "/catalog") await page.goto(path);
}

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "prohook-store", value: "store-1", domain: "127.0.0.1", path: "/" },
  ]);
});

test("first visit chooses a real city and store", async ({ page, context }) => {
  await context.clearCookies();
  await open(page, "/");
  const picker = page.getByRole("dialog", { name: "Ваш город и магазин" });
  await expect(picker).toBeVisible();
  await picker.getByLabel("Город", { exact: true }).selectOption("moscow");
  // Магазин применяется сразу при выборе — отдельной кнопки больше нет.
  await picker.getByRole("radio", { name: /МСК\. Боброво/ }).check();
  await expect(picker).not.toBeVisible();
  await expect(page.locator(".store-trigger")).toContainText("Москва");
  const cookies = await context.cookies();
  expect(cookies.find((cookie) => cookie.name === "prohook-store")?.value).toBe(
    "store-3",
  );
});

test("filters and sorting use the selected store price", async ({ page }) => {
  await open(page);
  const filters = page.locator(".catalog-sidebar");
  await expect(filters.getByText("Бренд")).toHaveCount(0);
  await expect(filters.getByText("Материал")).toHaveCount(0);
  // «Только в наличии» включён с открытия страницы: Подставка 01 с нулевым
  // остатком в store-1 скрыта, в выдаче 4 позиции из 5 (с 10.10.2026 в
  // выдаче и «Ароматизатор тестовый» — категория опубликована).
  await expect(filters.getByLabel("Только в наличии")).toBeChecked();
  await expect(page.locator(".product-card")).toHaveCount(4);
  await filters.getByLabel("От", { exact: true }).fill("1000");
  await filters.getByLabel("До", { exact: true }).fill("2000");
  // Цена применяется сама после паузы ввода — кнопки «Применить» нет.
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page).toHaveURL(/minPrice=1000/);
  await expect(page.locator(".filter-chips")).toContainText("Цена:");
  await page.getByLabel("Сортировка").selectOption("price-asc");
  await expect(page.locator(".product-card h3").first()).toHaveText(
    "Подставка 02",
  );
  await filters.getByRole("button", { name: "Сбросить фильтры" }).click();
  await expect(page.locator(".product-card")).toHaveCount(4);
});

test("store changes availability and city price without losing the product", async ({
  page,
}) => {
  await open(page, "/product/stands-01");
  const info = page.locator(".product-detail__info");
  await expect(info.locator(".product-price strong")).toContainText(/1\s?200/);
  await expect(info.locator(".availability")).toHaveText("Скоро в наличии");
  // Аноним без подтверждённой даты рождения не видит изображения: сервер
  // отдаёт пустой images, галерея показывает заглушку 18+.
  await expect(
    page.locator(".product-gallery").getByRole("img", {
      name: "Изображение доступно только совершеннолетним пользователям",
    }),
  ).toBeVisible();
  await expect(page.locator(".gallery-thumbnails")).toHaveCount(0);
  await info.getByRole("button", { name: "Изменить магазин" }).click();
  const picker = page.getByRole("dialog", { name: "Ваш город и магазин" });
  await picker.getByRole("radio", { name: /Студия · Север/ }).check();
  await expect(picker).not.toBeVisible();
  await expect(info.locator(".availability")).toHaveText("В наличии");
  await info.getByRole("button", { name: "Изменить магазин" }).click();
  await picker.getByLabel("Город", { exact: true }).selectOption("moscow");
  await picker.getByRole("radio", { name: /МСК\. Боброво/ }).check();
  await expect(info.locator(".product-price strong")).toContainText(/1\s?350/);
  await expect(info.locator(".availability")).toHaveText("Мало в наличии");
});

test("instant filters: availability is on by default, photo filter removed", async ({
  page,
}) => {
  await open(page);
  const sidebar = page.locator(".catalog-sidebar");
  // Фильтр наличия включён с открытия сайта: каталог показывает только
  // товары в выбранном магазине, чип фильтра уже активен.
  const available = sidebar.getByLabel("Только в наличии");
  await expect(available).toBeChecked();
  await expect(page.locator(".filter-chips li")).toHaveCount(2);
  // Фильтра «только с фотографиями» больше нет (убран по решению владельца
  // 10.10.2026) — в сайдбаре единственный чекбокс наличия.
  await expect(sidebar.getByRole("checkbox")).toHaveCount(1);
  await expect(sidebar.getByLabel("Только с фотографией")).toHaveCount(0);
  await available.uncheck();
  await expect(page).toHaveURL(/available=0/);
  // Позиции с нулевым остатком возвращаются в выдачу с меткой.
  await expect(page.locator(".product-card")).toHaveCount(5);
  await expect(page.locator(".product-card__soon")).toHaveCount(1);
  await expect(page.locator(".filter-chips")).toHaveCount(0);
  await sidebar.getByLabel("Только в наличии").check();
  await expect(page).toHaveURL(/available=1/);
  await expect(page.locator(".product-card")).toHaveCount(4);
  await expect(page.locator(".filter-chips li")).toHaveCount(2);
  await page
    .locator(".filter-chips")
    .getByRole("button", { name: "В наличии" })
    .click();
  await expect(page).not.toHaveURL(/available=1/);
  await expect(page.locator(".filter-chips")).toHaveCount(0);
});

test("search field in catalog shows live suggestions", async ({ page }) => {
  await open(page);
  // Поле поиска доступно прямо в каталоге, без перехода на /search.
  const field = page.getByLabel("Поиск по каталогу", { exact: true });
  await expect(field).toBeVisible();
  await field.fill("Блок");
  const suggest = page.getByRole("listbox", { name: "Подсказки поиска" });
  await expect(suggest.getByRole("option").first()).toContainText("Блокнот", {
    ignoreCase: true,
  });
  // Клик по подсказке ведёт на страницу товара.
  await suggest.getByRole("option").first().click();
  await expect(page).toHaveURL(/\/product\//);
});

test("category descendants, search, missing image and API pagination", async ({
  page,
  request,
}) => {
  await open(page, "/catalog/objects");
  // Фильтр наличия по умолчанию: из двух подставок видна только та, что
  // в store-1 в наличии; вторая — с нулевым остатком — скрыта.
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page
    .getByRole("navigation", { name: "Подкатегории" })
    .getByRole("link", { name: "Подставки" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Подставки", exact: true }),
  ).toBeVisible();
  await open(page, "/search?q=Блокнот");
  await expect(page.locator(".product-card")).toHaveCount(2);
  await open(page, "/product/stands-02");
  // Без подтверждённого 18+ заглушка возраста приоритетнее «нет изображения».
  await expect(
    page.locator(".product-gallery").getByRole("img", {
      name: "Изображение доступно только совершеннолетним пользователям",
    }),
  ).toBeVisible();
  const response = await request.get("/api/products?limit=2&page=2");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    total: 6,
    page: 2,
    pageCount: 3,
  });
});

test("suggest API matches names and slugs", async ({ request }) => {
  const response = await request.get("/api/products/suggest?q=Блокнот");
  expect(response.ok()).toBe(true);
  const payload = await response.json();
  expect(payload.items.length).toBeGreaterThan(0);
  expect(payload.items[0]).toMatchObject({
    name: expect.stringContaining("Блокнот"),
  });
  expect(payload.items[0]).not.toHaveProperty("images");
});

test("page in URL survives the price-filter sync (pagination regression)", async ({
  page,
}) => {
  // Регрессия: вотчер черновика цены реагировал на любую смену query
  // (в том числе ?page=) и через дебаунс эмитил «apply», который стирал
  // page и возвращал пользователя на первую страницу каталога.
  await open(page, "/catalog?page=2");
  await expect(page.locator(".product-card")).toHaveCount(4);
  await page.waitForTimeout(900);
  await expect(page).toHaveURL(/page=2/);
});

test("adjacent API returns category neighbours", async ({ request }) => {
  const response = await request.get("/api/products/stands-01/adjacent");
  expect(response.ok()).toBe(true);
  const { prev, next } = await response.json();
  expect(prev).toBeNull();
  expect(next).toMatchObject({ slug: "stands-02", name: "Подставка 02" });
  expect((await request.get("/api/products/missing/adjacent")).status()).toBe(
    404,
  );
});

test("product page switches to the neighbouring product", async ({ page }) => {
  await open(page, "/product/stands-01");
  const nav = page.locator("nav.product-adjacent");
  await expect(nav).toBeVisible();
  // Подпись «Следующий →» скрыта от скринридеров (aria-hidden), поэтому
  // ищем ссылку по тексту, а не по доступному имени.
  const next = nav.getByRole("link").filter({ hasText: "Следующий" });
  await expect(next).toContainText("Подставка 02");
  await next.click();
  await expect(page).toHaveURL(/stands-02/);
  await expect(
    nav.getByRole("link").filter({ hasText: "Предыдущий" }),
  ).toContainText("Подставка 01");
});

test("invalid category, product, store and price range return HTTP errors", async ({
  request,
}) => {
  // 404-статусы проверяем прямым запросом с подтверждением возраста:
  // до подтверждения контент страниц не рендерится и маршрут отвечает
  // 200 с гейтом. Браузерные переходы не используются — WebKit гоняет
  // навигации на страницах ошибок.
  const headers = { cookie: "prohook-age-confirmed=true" };
  for (const path of ["/catalog/missing", "/product/missing"]) {
    expect((await request.get(path, { headers })).status()).toBe(404);
  }
  expect((await request.get("/api/products?storeId=missing")).status()).toBe(
    400,
  );
  expect(
    (await request.get("/api/products?minPrice=200&maxPrice=100")).status(),
  ).toBe(400);
});

test("API failure is retryable", async ({ page }) => {
  await open(page);
  let fail = true;
  await page.route("**/api/products?**", async (route) => {
    if (fail)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"message":"Unavailable"}',
      });
    else await route.continue();
  });
  await page.getByLabel("Сортировка").selectOption("newest");
  await expect(
    page.getByRole("heading", { name: "Не удалось загрузить товары" }),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.locator(".product-card")).toHaveCount(4);
});

test("main pages fit mobile and desktop widths", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of [
    "/",
    "/catalog",
    "/product/stands-01",
    "/stores",
    "/search?q=Блокнот",
    "/reserve",
  ]) {
    await open(page, path);
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
        `${path} at ${width}`,
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

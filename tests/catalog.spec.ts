import { test, expect, type Page } from "@playwright/test";

async function open(page: Page, path = "/catalog") {
  await page.goto(path);
  await page.getByRole("button", { name: "Мне 18 лет или больше" }).click();
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
  await picker.getByRole("radio", { name: /МСК\. Боброво/ }).check();
  await picker
    .getByRole("button", { name: "Выбрать магазин", exact: true })
    .click();
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
  await filters.getByLabel("От", { exact: true }).fill("1000");
  await filters.getByLabel("До", { exact: true }).fill("2000");
  await filters.getByRole("button", { name: "Применить" }).click();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page.getByLabel("Сортировка").selectOption("price-asc");
  await expect(page.locator(".product-card h3").first()).toHaveText(
    "Подставка 01",
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
  await expect(info.locator(".availability")).toHaveText("Нет в наличии");
  await page.getByRole("button", { name: "Показать изображение 2" }).click();
  await expect(
    page.locator(".product-gallery > .product-image img"),
  ).toHaveAttribute("src", "/demo/detail.svg");
  await info.getByRole("button", { name: "Изменить магазин" }).click();
  const picker = page.getByRole("dialog", { name: "Ваш город и магазин" });
  await picker.getByRole("radio", { name: /Студия · Север/ }).check();
  await picker
    .getByRole("button", { name: "Выбрать магазин", exact: true })
    .click();
  await expect(info.locator(".availability")).toHaveText("В наличии");
  await info.getByRole("button", { name: "Изменить магазин" }).click();
  await picker.getByLabel("Город", { exact: true }).selectOption("moscow");
  await picker.getByRole("radio", { name: /МСК\. Боброво/ }).check();
  await picker
    .getByRole("button", { name: "Выбрать магазин", exact: true })
    .click();
  await expect(info.locator(".product-price strong")).toContainText(/1\s?350/);
  await expect(info.locator(".availability")).toHaveText("Мало в наличии");
});

test("category descendants, search, missing image and API pagination", async ({
  page,
  request,
}) => {
  await open(page, "/catalog/objects");
  await expect(page.locator(".product-card")).toHaveCount(2);
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
  await expect(
    page
      .locator(".product-gallery")
      .getByRole("img", { name: "Изображение отсутствует" }),
  ).toBeVisible();
  const response = await request.get("/api/products?limit=2&page=2");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    total: 4,
    page: 2,
    pageCount: 2,
  });
});

test("invalid category, product, store and price range return HTTP errors", async ({
  page,
  request,
}) => {
  for (const path of ["/catalog/missing", "/product/missing"]) {
    expect((await page.goto(path))?.status()).toBe(404);
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

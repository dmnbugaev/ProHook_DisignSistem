import { test, expect, type Page } from "@playwright/test";

// Клик по форме до гидрации Vue не доходит до обработчиков (известная
// особенность e2e проекта) — ждём монтирования приложения.
async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const root = document.getElementById("__nuxt") as
      (HTMLElement & { __vue_app__?: unknown }) | null;
    return !!root?.__vue_app__;
  });
}

test("partnership form validates, preserves errors and confirms delivery", async ({
  page,
}, testInfo) => {
  // /partners — публичная страница без гейта; возраст подтверждаем cookie
  // (эквивалент состояния после подтверждения на каталоге).
  await page.context().addCookies([
    {
      name: "prohook-age-confirmed",
      value: "true",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto("/partners");
  await waitForHydration(page);
  await expect(
    page.getByRole("dialog", { name: "Ваш город и магазин" }),
  ).not.toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("partners-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByLabel("ФИО", { exact: true })).toBeFocused();
  await page.getByLabel("ФИО", { exact: true }).fill("Иван Иванов");
  await page.getByLabel("Ваш телефон").fill("+7 999 123-45-67");
  await page.getByLabel("Город / регион").fill("Москва");
  await page.getByLabel("Название компании").fill("Компания");
  await page
    .getByLabel("Партнёрское предложение")
    .fill("Хотим закупать продукцию оптом для своей сети.");
  // Оба согласия пустые по умолчанию и обязательны по отдельности.
  const consents = page.getByRole("checkbox");
  await expect(consents.nth(0)).not.toBeChecked();
  await expect(consents.nth(1)).not.toBeChecked();
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(
    page.getByText("Подтвердите согласие на обработку"),
  ).toBeVisible();
  await expect(
    page.getByText("Подтвердите согласие на передачу заявки через Telegram"),
  ).toBeVisible();
  await consents.nth(0).check();
  await consents.nth(1).check();
  let succeeds = false;
  await page.route("**/api/partnership", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      name: "Иван Иванов",
      consent: true,
      consentTelegram: true,
      offer: "Хотим закупать продукцию оптом для своей сети.",
    });
    await route.fulfill({
      status: succeeds ? 200 : 502,
      contentType: "application/json",
      body: succeeds ? '{"ok":true,"id":"test"}' : '{"statusCode":502}',
    });
  });
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось подтвердить отправку",
  );
  await expect(page.getByLabel("ФИО", { exact: true })).toHaveValue(
    "Иван Иванов",
  );
  succeeds = true;
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(
    page.getByRole("heading", { name: "Заявка отправлена" }),
  ).toBeVisible();
});

test("partnership mobile layout fits the viewport", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  // /partners — публичная страница без гейта; возраст подтверждаем cookie
  // (эквивалент состояния после подтверждения на каталоге).
  await page.context().addCookies([
    {
      name: "prohook-age-confirmed",
      value: "true",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto("/partners");
  await waitForHydration(page);
  await expect(
    page.getByRole("heading", { name: "Стать партнёром." }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("partners-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("API rejects invalid payloads and cross-site requests", async ({
  request,
}) => {
  const invalid = await request.post("/api/partnership", { data: {} });
  expect(invalid.status()).toBe(422);
  const crossSite = await request.post("/api/partnership", {
    data: {},
    headers: { "sec-fetch-site": "cross-site" },
  });
  expect(crossSite.status()).toBe(403);
});

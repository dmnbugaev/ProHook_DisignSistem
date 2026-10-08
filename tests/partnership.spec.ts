import { test, expect } from "@playwright/test";

test("partnership form validates, preserves errors and confirms delivery", async ({
  page,
}, testInfo) => {
  await page.goto("/partners");
  await page.getByRole("button", { name: "Мне 18 лет или больше" }).click();
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
  await page.goto("/partners");
  await page.getByRole("button", { name: "Мне 18 лет или больше" }).click();
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

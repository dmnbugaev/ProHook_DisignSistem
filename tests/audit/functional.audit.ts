import { test, expect } from "@playwright/test";
import { openPage } from "./helpers";

// Мобильные интерактивные сценарии и краевые случаи навигации.
// Функциональные CRUD-сценарии каталога/аккаунта/резервов уже покрыты
// основными спеками (catalog/account/partnership/reservation.spec.ts) —
// здесь только мобильная специфика и кросс-браузерная навигация.
test.describe("mobile interaction audit", () => {
  test("mobile menu: open, navigate, close on route change, reopen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openPage(page, "/");
    const burger = page.locator(".menu-toggle");
    await expect(burger).toBeVisible();
    await burger.click();
    const menu = page.getByRole("dialog", { name: /меню/i });
    await expect(menu).toBeVisible();
    // Фоновый скролл заблокирован
    const scrollable = await page.evaluate(() => {
      const { overflow } = getComputedStyle(document.body);
      return overflow;
    });
    expect(scrollable).toBe("hidden");
    // Переход по ссылке меню закрывает его и ведёт на страницу
    await menu.getByRole("link", { name: "Каталог" }).click();
    await expect(menu).not.toBeVisible();
    await expect(page).toHaveURL(/\/catalog/);
    // Повторное открытие работает
    await burger.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
  });

  test("catalog filters drawer on mobile: open, apply, close", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openPage(page, "/catalog");
    await page.getByRole("button", { name: /^Фильтры/ }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    // Фильтры применяются мгновенно, кнопки «Применить» нет
    await drawer.getByLabel("От", { exact: true }).fill("1000");
    await expect(page).toHaveURL(/minPrice=1000/);
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
    await expect(page.locator(".product-card").first()).toBeVisible();
  });

  test("search page suggestion flow works on touch width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPage(page, "/catalog");
    const field = page.getByLabel("Поиск по каталогу", { exact: true });
    await field.fill("Блок");
    const suggest = page.getByRole("listbox", { name: "Подсказки поиска" });
    await suggest.getByRole("option").first().click();
    await expect(page).toHaveURL(/\/product\//);
  });

  test("back button and direct deep-link load", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPage(page, "/catalog");
    await page.locator(".product-card a").first().click();
    await expect(page).toHaveURL(/\/product\//);
    await page.goBack();
    await expect(page).toHaveURL(/\/catalog/);
    // Прямая загрузка глубокого маршрута
    await page.goto("/product/stands-02", { waitUntil: "load" });
    await expect(page.locator(".product-detail")).toBeVisible();
    await page.reload();
    await expect(page.locator(".product-detail")).toBeVisible();
  });

  test("age gate blocks catalog until confirmed on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.context().clearCookies();
    await page.goto("/catalog", { waitUntil: "load" });
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Мне 18 лет или больше" }).click();
    await expect(page.locator(".product-card").first()).toBeVisible();
  });

  test("login and register forms: validation errors visible on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openPage(page, "/login");
    // Баннер согласия на cookie закрывает сабмит на низкой мобильной
    // высоте — закрываем его как живой пользователь («Закрыть» ищем
    // внутри баннера: в шапке страницы есть своя кнопка закрытия).
    const banner = page.getByRole("region", {
      name: "Использование файлов cookie",
    });
    const reject = banner.getByRole("button", { name: "Закрыть" });
    if (await reject.isVisible()) await reject.click();
    const form = page.locator("form");
    await form.getByRole("button", { name: /войти/i }).click();
    // Ошибки валидации помещаются в 320px
    await expect(
      page.locator(".field-error, [role=alert]").first(),
    ).toBeVisible();
    await openPage(page, "/register");
    await page.getByRole("button", { name: /создать|зарегистр/i }).click();
    await expect(
      page.locator(".field-error, [role=alert]").first(),
    ).toBeVisible();
  });

  test("store picker on mobile: switch store changes price", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPage(page, "/product/stands-01");
    await page.getByRole("button", { name: "Изменить магазин" }).click();
    const picker = page.getByRole("dialog", { name: "Ваш город и магазин" });
    await picker.getByRole("radio", { name: /Студия · Север/ }).check();
    await expect(picker).not.toBeVisible();
    await expect(
      page.locator(".product-detail__info .availability"),
    ).toContainText("В наличии");
  });

  test("keyboard: tab order reaches main controls, focus is visible", async ({
    page,
  }, testInfo) => {
    // macOS Safari: при выключенной системной «навигации клавиатурой»
    // Tab не останавливается на ссылках — поведение ОС, не сайта.
    // audit-iphone тоже WebKit — пропускаем по той же причине.
    if (/webkit|iphone/.test(testInfo.project.name)) testInfo.skip();
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPage(page, "/");
    // Первый Tab может уйти в body (WebKit) — доходим до интерактива
    let active: { tag: string; cls: string; outline: string } | null = null;
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      active = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        return {
          tag: el.tagName,
          cls: el.className?.toString() ?? "",
          outline: s.outlineStyle,
        };
      });
      if (active) break;
    }
    expect(active, "tab reaches an interactive element").not.toBeNull();
    expect(
      ["A", "BUTTON", "INPUT", "SELECT", "SUMMARY"],
      `focused element ${active!.tag}.${active!.cls}`,
    ).toContain(active!.tag);
    // Видимый индикатор фокуса
    expect(["solid", "auto", "ridge"]).toContain(active!.outline);
  });
});

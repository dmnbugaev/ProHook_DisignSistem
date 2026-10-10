import { test, expect, type Page } from "@playwright/test";
import { ARTIFACTS, AUDIT_PAGES, ensureDir, openPage } from "./helpers";

// Полностраничные скриншоты всех страниц на приоритетных viewport.
// Каждый маршрут — отдельный тест (параллелится). Анализ — отдельно.
const SHOT_VIEWPORTS = [
  { width: 320, height: 568 }, // iPhone SE (1st gen)
  { width: 375, height: 667 }, // iPhone SE
  { width: 375, height: 812 }, // iPhone 12/13 mini
  { width: 390, height: 844 }, // iPhone 14/15/16
  { width: 393, height: 852 }, // iPhone 15/16 Pro
  { width: 402, height: 874 }, // iPhone 16 Pro Max
  { width: 430, height: 932 }, // iPhone Plus / Pro Max
  { width: 440, height: 956 }, // iPhone 17 Pro Max
  { width: 360, height: 800 }, // Android mid-range
  { width: 412, height: 915 }, // Pixel 5
  { width: 768, height: 1024 }, // iPad portrait
  { width: 1024, height: 768 }, // iPad landscape
  { width: 1440, height: 900 }, // laptop
  { width: 1920, height: 1080 }, // desktop
];

// Стабилизация: шрифты, изображения, ленивые секции. Ожидание картинок
// устойчиво к гонке «load уже случился до подписки» и не висит вечно.
async function stabilize(page: Page) {
  await page.evaluate(async () => {
    await Promise.race([
      document.fonts.ready,
      new Promise((r) => setTimeout(r, 2000)),
    ]);
    const imgs = Array.from(document.images);
    await Promise.race([
      Promise.all(
        imgs.map(
          (img) =>
            new Promise<void>((res) => {
              if (img.complete) return res();
              const done = () => res();
              img.addEventListener("load", done, { once: true });
              img.addEventListener("error", done, { once: true });
              setTimeout(done, 3000);
            }),
        ),
      ),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
    await new Promise(requestAnimationFrame);
    // Ленивые секции: скролл до низа и обратно, чтобы полностраничный
    // скриншот захватил их в отрисованном виде.
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise(requestAnimationFrame);
    window.scrollTo(0, 0);
    await new Promise(requestAnimationFrame);
  });
}

test.describe.configure({ mode: "parallel" });

// Каталог назначений: baseline (до фиксов) / fixed (после) — пара для
// сравнения «до/после» в отчёте. AUDIT_SHOT_DIR=fixed при повторном прогоне.
const SHOT_DIR = process.env.AUDIT_SHOT_DIR ?? "baseline";

for (const def of AUDIT_PAGES) {
  test(`shots: ${def.name}`, async ({ page }, testInfo) => {
    const browser = testInfo.project.name.replace("audit-", "");
    if (browser === "firefox") return; // firefox: только выборочные страницы
    const dir = `${ARTIFACTS}/screenshots/${SHOT_DIR}`;
    ensureDir(dir);
    for (const vp of SHOT_VIEWPORTS) {
      await page.setViewportSize(vp);
      await openPage(page, def.path);
      await stabilize(page);
      await page.screenshot({
        fullPage: true,
        path: `${dir}/${def.name}-${vp.width}x${vp.height}-${browser}.png`,
      });
    }
  });
}

test("shots: key states at iphone size", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "audit-chromium") return;
  const dir = `${ARTIFACTS}/screenshots/${SHOT_DIR}`;
  ensureDir(dir);
  await page.setViewportSize({ width: 390, height: 844 });

  // 18+-гейт (без cookie возраста)
  await page.context().clearCookies();
  await page.goto("/catalog", { waitUntil: "load" });
  await stabilize(page);
  await page.screenshot({ path: `${dir}/state-age-gate-390x844.png` });

  // Пикер города и магазина: открывается сам после подтверждения 18+
  await page.context().clearCookies();
  await page.goto("/catalog", { waitUntil: "load" });
  await page.getByRole("button", { name: "Мне 18 лет или больше" }).click();
  await stabilize(page);
  await page.screenshot({ path: `${dir}/state-store-picker-390x844.png` });

  // Мобильное меню открыто
  await openPage(page, "/");
  await page.locator(".menu-toggle").click();
  await stabilize(page);
  await page.screenshot({ path: `${dir}/state-mobile-menu-390x844.png` });
  await page.keyboard.press("Escape");

  // Пустой поиск
  await openPage(page, "/search?q=zzzzzz");
  await stabilize(page);
  await page.screenshot({ path: `${dir}/state-search-empty-390x844.png` });

  // Ошибка API каталога: перехват срабатывает на клиентский запрос,
  // поэтому дергаем сортировку после установки route
  await openPage(page, "/catalog");
  await page.route("**/api/products?**", (route) =>
    route.fulfill({ status: 503, body: '{"message":"Unavailable"}' }),
  );
  await page.getByLabel("Сортировка").selectOption("newest");
  await stabilize(page);
  await page.screenshot({ path: `${dir}/state-catalog-error-390x844.png` });
  await expect(
    page.getByRole("heading", { name: "Не удалось загрузить товары" }),
  ).toBeVisible();
});

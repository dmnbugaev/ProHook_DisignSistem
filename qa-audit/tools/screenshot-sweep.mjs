// Скриншот-свип: все маршруты × ключевые вьюпорты. Мобильные — приоритет.
// Результаты: qa-audit/screenshots/<route>-<width>.png (+ .full.png полные страницы для мобайл)
import { chromium, webkit } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = resolve(root, "qa-audit/screenshots");
mkdirSync(outDir, { recursive: true });

const base = "http://127.0.0.1:4317";
const routes = [
  { path: "/", name: "home" },
  { path: "/catalog", name: "catalog" },
  { path: "/catalog/stationery", name: "catalog-category" },
  { path: "/product/stands-01", name: "product" },
  { path: "/stores", name: "stores" },
  { path: "/contacts", name: "contacts" },
  { path: "/search?q=Блокнот", name: "search" },
  { path: "/reserve", name: "reserve" },
  { path: "/login", name: "login" },
  { path: "/register", name: "register" },
  { path: "/partners", name: "partners" },
  { path: "/about", name: "about" },
  { path: "/information", name: "information" },
  { path: "/privacy", name: "privacy" },
  { path: "/personal-data", name: "personal-data" },
];
const viewports = [
  [320, 568], [375, 667], [390, 844], [430, 932],
  [768, 1024], [1024, 1366],
  [1280, 720], [1440, 900], [1920, 1080],
];

const engine = process.argv[2] === "webkit" ? webkit : chromium;
const engineName = process.argv[2] === "webkit" ? "webkit" : "chromium";
const browser = await engine.launch();
const context = await browser.newContext();
await context.addCookies([
  { name: "prohook-age-confirmed", value: "true", domain: "127.0.0.1", path: "/" },
  { name: "prohook-store", value: "store-1", domain: "127.0.0.1", path: "/" },
  { name: "prohook-consent", value: JSON.stringify({ necessary: true, analytics: true }), domain: "127.0.0.1", path: "/" },
]);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

for (const r of routes) {
  for (const [w, h] of viewports) {
    await page.setViewportSize({ width: w, height: h });
    try {
      await page.goto(base + r.path, { waitUntil: "networkidle", timeout: 20000 });
    } catch {
      await page.goto(base + r.path, { waitUntil: "load", timeout: 20000 }).catch(() => {});
    }
    await page.waitForTimeout(2600); // полный цикл hero-анимаций
    const suffix = engineName === "chromium" ? "" : `-${engineName}`;
    await page.screenshot({ path: resolve(outDir, `${r.name}-${w}${suffix}.png`) });
    if (w <= 430) {
      await page.screenshot({ path: resolve(outDir, `${r.name}-${w}${suffix}-full.png`), fullPage: true });
    }
  }
  console.log(`done ${r.name}`);
}
await browser.close();
if (errors.length) {
  console.log("ОШИБКИ СТРАНИЦ (первые 15):");
  console.log([...new Set(errors)].slice(0, 15).join("\n"));
} else {
  console.log("ошибок консоли/страниц нет");
}

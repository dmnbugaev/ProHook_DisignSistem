// SEO/мета-свип: title, description, canonical, OG, robots, h1 для всех
// маршрутов; проверка 404 для несуществующих маршрутов; security-заголовки.
import { chromium } from "playwright";

const base = "http://127.0.0.1:4317";
const routes = [
  "/", "/about", "/catalog", "/catalog/stationery", "/product/stands-01",
  "/search?q=Блокнот", "/stores", "/contacts", "/partners", "/login",
  "/register", "/information", "/privacy", "/personal-data",
];

const browser = await chromium.launch();
const page = await browser.newPage();
const rows = [];
for (const path of routes) {
  const resp = await page.goto(base + path, { waitUntil: "domcontentloaded" });
  const meta = await page.evaluate(() => {
    const g = (sel) => document.querySelector(sel)?.getAttribute("content") ?? null;
    const title = document.title;
    const h1 = document.querySelector("h1")?.textContent?.trim() ?? null;
    return {
      title: title.slice(0, 70),
      titleLen: title.length,
      desc: g('meta[name="description"]'),
      descLen: (g('meta[name="description"]') || "").length,
      canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
      robots: g('meta[name="robots"]'),
      ogTitle: g('meta[property="og:title"]'),
      ogImage: g('meta[property="og:image"]'),
      h1Count: document.querySelectorAll("h1").length,
      h1: h1?.slice(0, 40),
    };
  });
  rows.push({ path, status: resp.status(), ...meta });
}
console.table(
  rows.map((r) => ({
    path: r.path,
    st: r.status,
    titleLen: r.titleLen,
    descLen: r.descLen,
    robots: r.robots?.slice(0, 22),
    h1: r.h1Count,
    canon: r.canonical ? new URL(r.canonical).pathname : null,
    og: r.ogTitle ? "+" : "-",
  })),
);
// Полные данные для отчёта
console.log("=== DETAIL ===");
for (const r of rows) console.log(JSON.stringify(r));

// 404-поведение
console.log("=== 404 ===");
for (const path of ["/catalog/nosuch", "/product/nosuch-item", "/no-such-page"]) {
  const resp = await page.goto(base + path, { waitUntil: "domcontentloaded" });
  const body = await page.evaluate(() => document.body.innerText.slice(0, 120));
  console.log(`${path} → ${resp.status()} | ${body.replace(/\n/g, " ").slice(0, 80)}`);
}

// Security-заголовки главной
console.log("=== HEADERS ===");
const h = await page.request.get(base + "/");
for (const [k, v] of Object.entries(await h.headers())) {
  if (/content-security|x-frame|x-content|referrer|strict-transport|permissions-policy/i.test(k))
    console.log(`${k}: ${v.slice(0, 160)}`);
}
await browser.close();

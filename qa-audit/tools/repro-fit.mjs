// Точная имитация теста "main pages fit": открытие на дефолтном вьюпорте,
// затем ресайз 375→768→1440 с проверкой scrollWidth. Цикл для ловли плавающего дефекта.
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:4317";
const paths = ["/", "/catalog", "/product/stands-01", "/stores", "/search?q=Блокнот", "/reserve"];
const widths = [375, 768, 1440];

const browser = await chromium.launch();
let failures = 0;

for (let iter = 0; iter < 3; iter++) {
  const context = await browser.newContext();
  await context.addCookies([
    { name: "prohook-age-confirmed", value: "true", domain: "127.0.0.1", path: "/" },
    { name: "prohook-store", value: "store-1", domain: "127.0.0.1", path: "/" },
    { name: "prohook-consent", value: JSON.stringify({ necessary: true, analytics: true }), domain: "127.0.0.1", path: "/" },
  ]);
  const page = await context.newPage();
  for (const path of paths) {
    await page.goto(base + path, { waitUntil: "load" });
    await page.waitForFunction(
      () =>
        document.getElementById("__nuxt")?.__vue_app__?.$nuxt?.isHydrating === false,
      undefined,
      { timeout: 10_000 },
    ).catch(() => console.log(`  (hydration wait timeout on ${path})`));
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      const ok = m.sw <= m.cw;
      if (!ok) {
        failures++;
        console.log(`FAIL iter=${iter} ${path} @${width}: scrollWidth=${m.sw} clientWidth=${m.cw}`);
        // найдем виновника
        const off = await page.evaluate((vw) => {
          const res = [];
          for (const el of document.querySelectorAll("*")) {
            const cs = getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden") continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            if (r.right > vw + 0.5) {
              const parent = el.parentElement;
              const pr = parent ? parent.getBoundingClientRect() : null;
              if (!pr || pr.right <= vw + 0.5) {
                res.push({
                  tag: el.tagName.toLowerCase(),
                  cls: String(el.className?.baseVal ?? el.className ?? "").slice(0, 100),
                  right: Math.round(r.right),
                  w: Math.round(r.width),
                  text: (el.textContent || "").trim().slice(0, 50),
                });
              }
            }
          }
          return res.slice(0, 10);
        }, width);
        for (const o of off) console.log(`   <${o.tag}> .${o.cls} R=${o.right} W=${o.w} «${o.text}»`);
      }
    }
  }
  await context.close();
  console.log(`iter ${iter} done, failures so far: ${failures}`);
}
console.log(failures === 0 ? "OK: переполнений не найдено за 3 итерации" : `TOTAL FAILURES: ${failures}`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);

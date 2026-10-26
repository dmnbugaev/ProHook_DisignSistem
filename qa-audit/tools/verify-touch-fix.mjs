// Верификация изменённых touch-таргетов: сегменты (44px, мобильная строка),
// catalog-back (44px), CTA промо. Плюс контроль раскладки контрол-рядов.
import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.addCookies([
  { name: "prohook-age-confirmed", value: "true", domain: "127.0.0.1", path: "/" },
  { name: "prohook-store", value: "store-1", domain: "127.0.0.1", path: "/" },
]);
const page = await ctx.newPage();

async function measure(url, width) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(2400);
  return page.evaluate(() => {
    const out = { segments: [], controls: [], back: null, cta: null };
    const segs = document.querySelectorAll(".promos__segment");
    segs.forEach((s) => {
      const cs = getComputedStyle(s);
      const after = getComputedStyle(s, "::after");
      out.segments.push({
        w: s.offsetWidth,
        h: s.offsetHeight,
        barColor: after.backgroundColor,
        barInset: after.inset,
      });
    });
    const controls = document.querySelector(".promos__controls");
    if (controls) {
      const cr = controls.getBoundingClientRect();
      out.controlsHeight = Math.round(cr.height);
      out.controlsWrap = getComputedStyle(controls).flexWrap;
      // сегменты не пересекаются со стрелками/счётчиком
      const rows = new Set(
        Array.from(controls.children).map((c) =>
          Math.round(c.getBoundingClientRect().top),
        ),
      );
      out.childTops = [...rows];
    }
    const back = document.querySelector(".catalog-back");
    if (back) out.back = { w: back.offsetWidth, h: back.offsetHeight };
    const cta = document.querySelector(".promo-card--active .promo-card__cta");
    if (cta) out.cta = { w: cta.offsetWidth, h: cta.offsetHeight };
    return out;
  });
}

for (const w of [320, 375, 768, 1440]) {
  const m = await measure("http://127.0.0.1:4317/", w);
  console.log(`HOME @${w}: сегменты=${JSON.stringify(m.segments)} controlsH=${m.controlsHeight} wrap=${m.controlsWrap} top-ряды=${m.childTops?.join(",")} cta=${JSON.stringify(m.cta)}`);
}
for (const w of [320, 375, 1440]) {
  const m = await measure("http://127.0.0.1:4317/catalog/stationery", w);
  console.log(`CATALOG @${w}: catalog-back=${JSON.stringify(m.back)}`);
}
await browser.close();

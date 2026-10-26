// Диагностика touch-таргетов на главной (375): CTA промо, сегменты, catalog-back.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
await page.context().addCookies([
  { name: "prohook-age-confirmed", value: "true", domain: "127.0.0.1", path: "/" },
  { name: "prohook-consent", value: JSON.stringify({ necessary: true, analytics: true }), domain: "127.0.0.1", path: "/" },
]);
await page.goto("http://127.0.0.1:4317/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  const out = {};
  const cta = document.querySelector(".promo-card__cta");
  if (cta) {
    const cs = getComputedStyle(cta);
    const r = cta.getBoundingClientRect();
    out.cta = {
      rect: [Math.round(r.width), Math.round(r.height)],
      minHeight: cs.minHeight,
      display: cs.display,
      padding: cs.padding,
      lineHeight: cs.lineHeight,
      fontSize: cs.fontSize,
      boxSizing: cs.boxSizing,
      text: cta.textContent?.trim().slice(0, 30),
    };
  }
  const seg = document.querySelector(".promos__segment");
  if (seg) {
    const cs = getComputedStyle(seg);
    const r = seg.getBoundingClientRect();
    out.segment = {
      rect: [Math.round(r.width), Math.round(r.height)],
      height: cs.height,
      padding: cs.padding,
      positionStatic: getComputedStyle(seg.parentElement).position,
      parentWidth: Math.round(seg.parentElement.getBoundingClientRect().width),
      parentChildren: seg.parentElement.children.length,
    };
  }
  const controls = document.querySelector(".promos__controls");
  if (controls) {
    out.controlsRow = Array.from(controls.children).map((c) => {
      const r = c.getBoundingClientRect();
      return `${c.className || c.tagName}: ${Math.round(r.width)}×${Math.round(r.height)}`;
    });
  }
  return out;
});
console.log(JSON.stringify(info, null, 1));
await browser.close();

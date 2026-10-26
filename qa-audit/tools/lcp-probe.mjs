// LCP через PerformanceObserver (buffered), мобильная эмуляция.
import { chromium } from "playwright";

const base = "http://127.0.0.1:4317";
const browser = await chromium.launch();
for (const path of ["/", "/catalog", "/product/stands-01", "/stores"]) {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addCookies([
    { name: "prohook-age-confirmed", value: "true", domain: "127.0.0.1", path: "/" },
    { name: "prohook-store", value: "store-1", domain: "127.0.0.1", path: "/" },
  ]);
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__lcp = null;
    new PerformanceObserver((l) => {
      const es = l.getEntries();
      window.__lcp = es.at(-1);
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await page.goto(base + path, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  const lcp = await page.evaluate(() => {
    const e = window.__lcp;
    return e
      ? {
          ms: Math.round(e.startTime),
          el: `${e.element?.tagName?.toLowerCase()}.${String(e.element?.className).slice(0, 50)}`,
          url: (e.url || "").slice(-60),
        }
      : null;
  });
  console.log(`${path}: LCP=${lcp ? `${lcp.ms}ms (${lcp.el} ${lcp.url})` : "нет записей"}`);
  await ctx.close();
}
await browser.close();

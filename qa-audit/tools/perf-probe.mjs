// Performance-проба (лабораторная): LCP, CLS, запросы, байты, JS-бандл.
// Мобильная эмуляция (4G-троттлинг CPU 4x) + десктоп без троттлинга.
import { chromium } from "playwright";

const base = "http://127.0.0.1:4317";
const browser = await chromium.launch();

async function probe(url, mobile) {
  const ctx = await browser.newContext(
    mobile
      ? { viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 } },
  );
  await ctx.addCookies([
    { name: "prohook-age-confirmed", value: "true", domain: "127.0.0.1", path: "/" },
    { name: "prohook-store", value: "store-1", domain: "127.0.0.1", path: "/" },
  ]);
  const page = await ctx.newPage();
  if (mobile) await page.emulateCPUThrottling?.(4).catch(() => {});
  let bytes = 0;
  let requests = 0;
  page.on("response", (r) => {
    requests++;
    const len = Number(r.headers()["content-length"] ?? 0);
    bytes += len;
  });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paints = performance.getEntriesByType("paint");
    const lcp = performance
      .getEntriesByType("largest-contentful-paint")
      .at(-1);
    let cls = 0;
    for (const e of performance.getEntriesByType("layout-shift"))
      if (!e.hadRecentInput) cls += e.value;
    const scripts = performance
      .getEntriesByType("resource")
      .filter((r) => r.name.endsWith(".js") || r.name.includes(".js?"));
    return {
      ttfb: Math.round(nav?.responseStart ?? 0),
      fcp: Math.round(paints.find((p) => p.name === "first-contentful-paint")?.startTime ?? 0),
      lcp: Math.round(lcp?.startTime ?? 0),
      lcpEl: lcp?.element ? `${lcp.element.tagName.toLowerCase()}.${String(lcp.element.className).slice(0, 40)}` : null,
      cls: Math.round(cls * 1000) / 1000,
      jsFiles: scripts.length,
      jsBytes: Math.round(scripts.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
    };
  });
  await ctx.close();
  return { ...m, requests, bytesKB: Math.round(bytes / 1024) };
}

for (const path of ["/", "/catalog", "/product/stands-01", "/stores"]) {
  const mob = await probe(base + path, true);
  console.log(`MOBILE ${path}: TTFB=${mob.ttfb} FCP=${mob.fcp} LCP=${mob.lcp} (${mob.lcpEl}) CLS=${mob.cls} js=${mob.jsFiles}/${mob.jsBytes}KB req=${mob.requests} ${mob.bytesKB}KB`);
}
const d = await probe(base + "/", false);
console.log(`DESKTOP /: TTFB=${d.ttfb} FCP=${d.fcp} LCP=${d.lcp} CLS=${d.cls} js=${d.jsFiles}/${d.jsBytes}KB req=${d.requests} ${d.bytesKB}KB`);
await browser.close();

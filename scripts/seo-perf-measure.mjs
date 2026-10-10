/**
 * Лабораторный замер производительности страниц (TTFB/LCP/CLS) на
 * мобильной эмуляции: Slow 4G (1.6 Мбит/с, RTT 150 мс), CPU x4,
 * viewport 390x844. Запуск:
 *
 *   node scripts/seo-perf-measure.mjs [base-url] [out.json]
 *
 * По умолчанию — http://127.0.0.1:4173 и /tmp/perf.json. Требует
 * запущенного сервера (например, MOYSKLAD_SNAPSHOT_PATH=tests/fixtures/
 * catalog.json node .output/server/index.mjs). Числа лабораторные
 * (localhost-сеть без реального RTT) — годятся для сравнения до/после,
 * а не как полевые Core Web Vitals.
 */
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://127.0.0.1:4173";
const out = process.argv[3] ?? "/tmp/perf.json";
const runs = 3;

const browser = await chromium.launch();

async function measure(path, { ageCookie = false } = {}) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    if (ageCookie)
      await context.addCookies([
        {
          name: "prohook-age-confirmed",
          value: "true",
          domain: "127.0.0.1",
          path: "/",
        },
      ]);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    // Фиксированный «прогрев» вместо networkidle: карта на /contacts
    // на медленном канале грузится непрерывно и networkidle не наступает.
    const response = await page
      .goto(base + path, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      })
      .catch(() => null);
    // Observers регистрируются ПОСЛЕ навигации (контекст about:blank
    // уничтожается при goto), buffered:true отдаёт уже накопленные записи.
    await page.evaluate(() => {
      window.__seoMetrics = { lcp: 0, cls: 0 };
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length)
          window.__seoMetrics.lcp = entries[entries.length - 1].startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput) window.__seoMetrics.cls += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.waitForTimeout(8000);
    try {
      const nav = await page.evaluate(() => {
        const navigation = performance.getEntriesByType("navigation")[0];
        const metrics = window.__seoMetrics;
        return {
          ttfb: Math.round(navigation?.responseStart ?? 0),
          lcp: Math.round(metrics?.lcp ?? 0),
          cls: +(metrics?.cls ?? 0).toFixed(3),
          transferredKb: Math.round(
            performance
              .getEntriesByType("resource")
              .reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024,
          ),
        };
      });
      samples.push({ status: response?.status() ?? 0, ...nav });
    } catch (error) {
      samples.push({ status: response?.status() ?? 0, error: String(error) });
    }
    await context.close();
  }
  const ok = samples.filter((s) => !s.error);
  const median = (key) =>
    ok.length
      ? ok.map((s) => s[key]).sort((a, b) => a - b)[Math.floor(ok.length / 2)]
      : 0;
  return {
    status: samples[0]?.status ?? 0,
    ttfb: median("ttfb"),
    lcp: median("lcp"),
    cls: median("cls"),
    transferredKb: median("transferredKb"),
    samples,
  };
}

const results = {
  home_bot: await measure("/"),
  home_confirmed: await measure("/", { ageCookie: true }),
  contacts_bot: await measure("/contacts"),
  stores_bot: await measure("/stores"),
  about_bot: await measure("/about"),
};
writeFileSync(out, JSON.stringify(results, null, 2));
for (const [name, value] of Object.entries(results)) {
  console.log(
    `${name}: TTFB ${value.ttfb}ms · LCP ${(value.lcp / 1000).toFixed(2)}s · CLS ${value.cls} · ${value.transferredKb}KB · HTTP ${value.status}`,
  );
}
await browser.close();

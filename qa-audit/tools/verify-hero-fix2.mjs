// Верификация в реалистичном окне: load+hydration (как e2e), затем цикл
// замеров в течение burst-анимации и после. 8 итераций на 375.
import { chromium } from "playwright";

const base = "http://127.0.0.1:4317";
const browser = await chromium.launch();
let bad = 0;
for (let i = 0; i < 8; i++) {
  const context = await browser.newContext();
  await context.addCookies([
    { name: "prohook-age-confirmed", value: "true", domain: "127.0.0.1", path: "/" },
    { name: "prohook-store", value: "store-1", domain: "127.0.0.1", path: "/" },
    { name: "prohook-consent", value: JSON.stringify({ necessary: true, analytics: true }), domain: "127.0.0.1", path: "/" },
  ]);
  const page = await context.newPage();
  await page.goto(base + "/", { waitUntil: "load" });
  await page.waitForFunction(
    () => document.getElementById("__nuxt")?.__vue_app__?.$nuxt?.isHydrating === false,
    undefined,
    { timeout: 10_000 },
  ).catch(() => {});
  await page.setViewportSize({ width: 375, height: 900 });
  const overs = [];
  for (let t = 0; t < 15; t++) {
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    if (m.sw > m.cw) overs.push(m);
    await page.waitForTimeout(150);
  }
  if (overs.length) {
    bad++;
    console.log(`FAIL run${i}:`, overs.slice(0, 3));
  } else {
    console.log(`OK run${i}`);
  }
  await context.close();
}
console.log(bad === 0 ? "ФИКСА ПОДТВЕРЖДЕНА (8/8 чисто)" : `ПРОБЛЕМ: ${bad}/8`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);

// Диагностика: какой floating-scene__item вылезает при ресайзе 1280→375,
// его inline-переменные, computed translate и состояние анимации.
import { chromium } from "playwright";

const base = "http://127.0.0.1:4317";
const browser = await chromium.launch();
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
);
// ждём завершения burst-анимаций (максимальный delay ~1100 + 1100ms)
await page.waitForTimeout(2500);
await page.setViewportSize({ width: 375, height: 900 });
await page.waitForTimeout(300);

const report = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const de = document.documentElement;
  const info = { vw, scrollWidth: de.scrollWidth, items: [] };
  const scene = document.querySelector(".floating-scene");
  if (scene) {
    const sr = scene.getBoundingClientRect();
    info.scene = { left: sr.left, right: Math.round(sr.right), width: Math.round(sr.width), height: Math.round(sr.height) };
  }
  for (const el of document.querySelectorAll(".floating-scene__item")) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const anims = el.getAnimations({ subtree: true }).map((a) => ({
      name: a.animationName || a.transitionProperty || String(a.constructor.name),
      state: a.playState,
      time: Math.round((a.currentTime || 0)),
      progress: typeof a.effect?.getComputedTiming === "function" ? Math.round((a.effect.getComputedTiming().progress || 0) * 100) / 100 : null,
    }));
    info.items.push({
      cls: el.className,
      right: Math.round(r.right),
      left: Math.round(r.left),
      width: Math.round(r.width),
      translate: cs.translate,
      inlineStyle: el.getAttribute("style")?.slice(0, 160),
      anims,
    });
  }
  return info;
});
console.log(JSON.stringify(report, null, 1).slice(0, 6000));
await browser.close();

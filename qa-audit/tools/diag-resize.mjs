// Диагностика overflow при ресайзе 1280→375 на живом сервере: кто даёт 488.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.context().addCookies([
  { name: "prohook-age-confirmed", value: "true", domain: "127.0.0.1", path: "/" },
]);
await page.goto("http://127.0.0.1:4317/", { waitUntil: "load" });
await page.waitForFunction(
  () => document.getElementById("__nuxt")?.__vue_app__?.$nuxt?.isHydrating === false,
  undefined, { timeout: 10_000 },
);
await page.setViewportSize({ width: 375, height: 900 });
const dump = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const out = { vw, sw: document.documentElement.scrollWidth, off: [] };
  for (const el of document.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > vw + 0.5) {
      const p = el.parentElement;
      const pr = p?.getBoundingClientRect();
      if (!pr || pr.right <= vw + 0.5) {
        out.off.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className?.baseVal ?? el.className ?? "").slice(0, 90),
          L: Math.round(r.left), R: Math.round(r.right), W: Math.round(r.width),
          clippedBy: (() => {
            let a = el.parentElement;
            while (a) {
              const s = getComputedStyle(a);
              if (s.overflowX !== "visible" || s.overflow !== "visible") return a.className || a.tagName;
              a = a.parentElement;
            }
            return null;
          })(),
        });
      }
    }
  }
  return out;
});
console.log(`sw=${dump.sw} vw=${dump.vw}`);
for (const o of dump.off.slice(0, 15)) console.log(JSON.stringify(o));
await browser.close();

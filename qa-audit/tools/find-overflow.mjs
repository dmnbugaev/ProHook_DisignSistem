// Поиск элементов, выходящих за правую границу вьюпорта.
// Использование: node qa-audit/tools/find-overflow.mjs <URL> <width> [height]
import { chromium } from "playwright";

const [url, w, h = "900"] = process.argv.slice(2);
if (!url || !w) {
  console.error("usage: node find-overflow.mjs <URL> <width> [height]");
  process.exit(1);
}
const width = Number(w);
const height = Number(h);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width, height },
});
await page.addInitScript(() => {
  document.cookie = "prohook-consent={%22necessary%22:true%2C%22analytics%22:true}; path=/";
});
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(500);

const doc = await page.evaluate(() => {
  const de = document.documentElement;
  return {
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
  };
});
console.log(`doc: scrollWidth=${doc.scrollWidth} clientWidth=${doc.clientWidth}`);

const offenders = await page.evaluate((vw) => {
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > vw + 0.5 || r.left < -0.5) {
      // поднимаемся до потомка, который сам вылезает, а родитель — нет
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && String(el.className.baseVal ?? el.className)).slice(0, 80),
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
        text: (el.textContent || "").trim().slice(0, 40),
      });
    }
  }
  return out;
}, width);

if (offenders.length === 0) {
  console.log("нет выходящих элементов");
} else {
  // показываем только самые внешние (без родителя в списке)
  console.log(`всего выходящих: ${offenders.length}, первые 25:`);
  for (const o of offenders.slice(0, 25)) {
    console.log(
      `<${o.tag}> .${o.cls} L=${o.left} R=${o.right} W=${o.width} «${o.text}»`,
    );
  }
}
await browser.close();

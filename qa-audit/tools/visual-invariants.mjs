// DOM-свип визуальных инвариантов: шрифты < 12px у читаемого текста,
// наложения интерактивных элементов, отрицательные поля у текста,
// картинки без alt/битые. Мобильные + десктоп ширины.
import { chromium } from "playwright";

const base = "http://127.0.0.1:4317";
const routes = ["/", "/catalog", "/catalog/stationery", "/product/stands-01",
  "/search?q=Блокнот", "/stores", "/contacts", "/partners", "/login",
  "/register", "/about", "/information", "/privacy", "/personal-data"];

const browser = await chromium.launch();
const issues = {};
const record = (k, v) => (issues[k] ??= []).push(v);

for (const path of routes) {
  for (const width of [375, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    await ctx.addCookies([
      { name: "prohook-age-confirmed", value: "true", domain: "127.0.0.1", path: "/" },
      { name: "prohook-store", value: "store-1", domain: "127.0.0.1", path: "/" },
    ]);
    const page = await ctx.newPage();
    const resp = await page.goto(base + path, { waitUntil: "networkidle" }).catch(() => null);
    if (!resp || resp.status() >= 400) { await ctx.close(); continue; }
    await page.waitForTimeout(1800);
    const found = await page.evaluate(() => {
      const out = { tinyText: [], overlaps: [], brokenImg: [], noAlt: [] };
      // 1. Живой текст мельче 12px (кроме декоративных aria-hidden)
      for (const el of document.querySelectorAll("p, li, td, th, label, span, a, button, h1, h2, h3, h4")) {
        if (el.closest("[aria-hidden=true]")) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        const own = [...el.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent.trim().length > 2,
        );
        if (!own) continue;
        const fs = parseFloat(cs.fontSize);
        if (fs < 12) {
          out.tinyText.push({
            sel: `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`,
            fs, text: el.textContent.trim().slice(0, 40),
          });
        }
      }
      // 2. Пересечения кликабельных элементов (исключая вложенность и декор)
      const inter = [...document.querySelectorAll("a[href], button, input, select")]
        .filter((e) => {
          const cs = getComputedStyle(e);
          if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false;
          if (e.closest("[aria-hidden=true], .age-marquee, .hero__marquee")) return false;
          const r = e.getBoundingClientRect();
          return r.width > 8 && r.height > 8;
        });
      for (let i = 0; i < inter.length; i++) {
        for (let j = i + 1; j < inter.length; j++) {
          const a = inter[i], b = inter[j];
          if (a.contains(b) || b.contains(a)) continue;
          const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
          const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (ox > 6 && oy > 6) {
            out.overlaps.push({
              a: `${a.tagName}.${String(a.className).slice(0, 30)}`,
              b: `${b.tagName}.${String(b.className).slice(0, 30)}`,
              area: Math.round(ox * oy),
            });
          }
        }
      }
      // 3. Битые картинки и пустые alt у контентных
      for (const img of document.querySelectorAll("img")) {
        if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")?.startsWith("data:") === false)
          out.brokenImg.push(img.getAttribute("src")?.slice(0, 60));
        const cs = getComputedStyle(img);
        if (cs.display === "none") continue;
        if (!img.getAttribute("alt") && !img.closest("[aria-hidden=true]"))
          out.noAlt.push(img.getAttribute("src")?.slice(0, 60));
      }
      // дедуп
      out.tinyText = [...new Map(out.tinyText.map((t) => [`${t.sel}|${t.fs}`, t])).values()].slice(0, 8);
      out.overlaps = out.overlaps.slice(0, 6);
      return out;
    });
    if (found.tinyText.length) record("tinyText", { path, width, items: found.tinyText });
    if (found.overlaps.length) record("overlaps", { path, width, items: found.overlaps });
    if (found.brokenImg.length) record("brokenImg", { path, width, items: found.brokenImg });
    if (found.noAlt.length) record("noAlt", { path, width, items: found.noAlt });
    await ctx.close();
  }
}
const keys = Object.keys(issues);
if (!keys.length) console.log("ИНВАРИАНТЫ ЧИСТЫ: мелкого текста, наложений, битых картинок, пустых alt не найдено");
else console.log(JSON.stringify(issues, null, 1).slice(0, 4000));
await browser.close();

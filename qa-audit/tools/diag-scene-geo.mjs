// Геометрия сцены hero: где предметы относительно hero/страницы на разных
// ширинах и при параллаксе (pointermove к правому краю).
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.context().addCookies([
  { name: "prohook-age-confirmed", value: "true", domain: "127.0.0.1", path: "/" },
]);

for (const width of [375, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("http://127.0.0.1:4317/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const geo = await page.evaluate(() => {
    const hero = document.querySelector(".hero").getBoundingClientRect();
    const scene = document.querySelector(".floating-scene").getBoundingClientRect();
    const items = [...document.querySelectorAll(".floating-scene__item")]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0);
    return {
      heroTop: Math.round(hero.top),
      heroBottom: Math.round(hero.bottom),
      sceneTop: Math.round(scene.top),
      sceneH: Math.round(scene.height),
      minTop: Math.round(Math.min(...items.map((r) => r.top))),
      maxBottom: Math.round(Math.max(...items.map((r) => r.bottom))),
      maxRight: Math.round(Math.max(...items.map((r) => r.right))),
      vw: document.documentElement.clientWidth,
      docSW: document.documentElement.scrollWidth,
    };
  });
  console.log(`@${width}:`, JSON.stringify(geo));
  if (width === 1440) {
    // параллакс: ведём указатель к правому нижнему углу hero
    await page.mouse.move(1420, Math.round(geo.heroTop + geo.sceneH / 2));
    await page.waitForTimeout(700);
    const par = await page.evaluate(() => {
      const items = [...document.querySelectorAll(".floating-scene__item")]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0);
      return {
        maxRight: Math.round(Math.max(...items.map((r) => r.right))),
        minLeft: Math.round(Math.min(...items.map((r) => r.left))),
        docSW: document.documentElement.scrollWidth,
        vw: document.documentElement.clientWidth,
      };
    });
    console.log(`@1440 parallax:`, JSON.stringify(par));
  }
}
await browser.close();

// Верификация фиксы: scrollWidth во время burst-анимации при ресайзе 1280→375,
// плюс проверка, что overflow-y остался visible (вертикальные вылеты не срезаны).
import { chromium } from "playwright";

const base = "http://127.0.0.1:4317";
const browser = await chromium.launch();
let bad = 0;

// Сценарий 1: замеры сразу после load — внутри окна анимации (0-2.5с)
for (let i = 0; i < 3; i++) {
  const context = await browser.newContext();
  await context.addCookies([
    { name: "prohook-age-confirmed", value: "true", domain: "127.0.0.1", path: "/" },
    { name: "prohook-store", value: "store-1", domain: "127.0.0.1", path: "/" },
    { name: "prohook-consent", value: JSON.stringify({ necessary: true, analytics: true }), domain: "127.0.0.1", path: "/" },
  ]);
  const page = await context.newPage();
  await page.goto(base + "/", { waitUntil: "commit" });
  await page.setViewportSize({ width: 375, height: 900 });
  const samples = [];
  for (let t = 0; t < 12; t++) {
    samples.push(
      await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      })),
    );
    await page.waitForTimeout(200);
  }
  const overs = samples.filter((s) => s.sw > s.cw);
  if (overs.length) {
    bad++;
    console.log(`FAIL run${i}: ${overs.length}/12 замеров с overflow`, overs[0]);
  } else {
    console.log(`OK run${i}: все 12 замеров scrollWidth<=clientWidth (${samples[0].sw}/${samples[0].cw}..${samples[11].sw}/${samples[11].cw})`);
  }
  await context.close();
}

// Сценарий 2: ресайз после полной загрузки (как в тесте) + состояние осей
const context = await browser.newContext();
await context.addCookies([
  { name: "prohook-age-confirmed", value: "true", domain: "127.0.0.1", path: "/" },
]);
const page = await context.newPage();
await page.goto(base + "/", { waitUntil: "load" });
await page.setViewportSize({ width: 375, height: 900 });
const axes = await page.evaluate(() => {
  const scene = document.querySelector(".floating-scene");
  const cs = getComputedStyle(scene);
  return { x: cs.overflowX, y: cs.overflowY, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
});
console.log(`оси сцены: overflow-x=${axes.x} overflow-y=${axes.y}; doc ${axes.sw}/${axes.cw}`);
if (axes.x !== "clip" || axes.y === "hidden" || axes.y === "clip") {
  console.log("WARN: оси не так, как ожидалось (clip+visible)");
  bad++;
}
await browser.close();
console.log(bad === 0 ? "ФИКСА ПОДТВЕРЖДЕНА" : `ПРОБЛЕМ: ${bad}`);
process.exit(bad === 0 ? 0 : 1);

import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import {
  ARTIFACTS,
  AUDIT_PAGES,
  collectLayoutDefects,
  ensureDir,
  openPage,
  sweepWidths,
} from "./helpers";

// Свип ширины viewport: 280–2560 с мелким шагом в мобильном диапазоне.
// Каждый маршрут — отдельный тест (параллелится по воркерам). Chromium
// проходит полный набор ширин; остальные браузеры — контрольные точки
// (движки раскладку согласуют, полный дубль избыточен).
const KEY_WIDTHS = [
  280, 320, 344, 359, 360, 374, 375, 390, 393, 402, 412, 428, 430, 440, 480,
  568, 640, 767, 768, 820, 991, 1023, 1024, 1280, 1440, 1920,
];

test.describe.configure({ mode: "parallel" });

for (const def of AUDIT_PAGES) {
  test(`fit: ${def.name} across all widths`, async ({ page }, testInfo) => {
    ensureDir(`${ARTIFACTS}/reports`);
    const full = testInfo.project.name === "audit-chromium";
    const widths = full ? sweepWidths() : KEY_WIDTHS;
    const findings: Record<string, unknown>[] = [];

    await openPage(page, def.path);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      const defects = await collectLayoutDefects(page);
      const pageDefects = defects.pageOverflow > 1 || defects.spill.length > 0;
      const textDefects = defects.textClip.length > 0;
      if (pageDefects) findings.push({ page: def.name, width, ...defects });
      else if (textDefects)
        findings.push({ page: def.name, width, textClip: defects.textClip });
    }

    // Ландшафт iPhone — только в полном прогоне (chromium)
    if (full) {
      for (const size of [
        { width: 568, height: 320 },
        { width: 667, height: 375 },
        { width: 812, height: 375 },
        { width: 844, height: 390 },
        { width: 852, height: 393 },
        { width: 896, height: 414 },
        { width: 926, height: 428 },
        { width: 932, height: 430 },
        { width: 956, height: 440 },
      ]) {
        await page.setViewportSize(size);
        const defects = await collectLayoutDefects(page);
        if (defects.pageOverflow > 1 || defects.spill.length > 0)
          findings.push({
            page: def.name,
            landscape: true,
            ...size,
            ...defects,
          });
      }
    }

    const report = `${ARTIFACTS}/reports/overflow-${def.name}-${testInfo.project.name}.json`;
    writeFileSync(report, JSON.stringify(findings, null, 2));
    const summary = findings.map((f) => {
      const spill = (f.spill as unknown[])?.length ?? 0;
      const clip = (f.textClip as unknown[])?.length ?? 0;
      return `${f.page}@${f.width ?? "landscape"}: overflow=${f.pageOverflow ?? 0} spill=${spill} textClip=${clip}`;
    });
    expect(summary, `layout defects (details: ${report})`).toEqual([]);
  });
}

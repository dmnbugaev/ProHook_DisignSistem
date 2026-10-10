import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import {
  ARTIFACTS,
  AUDIT_PAGES,
  collectTouchTargets,
  ensureDir,
  openPage,
} from "./helpers";

// Аудит touch-targets на мобильных ширинах: все интерактивные элементы
// ≥ 44×44 CSS px (Apple HIG). Отчёт со всеми целями — JSON.
const MOBILE_WIDTHS = [320, 375, 390, 430];

test.describe("touch target audit", () => {
  ensureDir(`${ARTIFACTS}/reports`);

  test("interactive elements meet 44x44 minimum", async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name !== "audit-chromium") return;
    const small: unknown[] = [];
    const all: unknown[] = [];
    for (const def of AUDIT_PAGES) {
      // /design-system — внутренний стайлгайд (noindex), не пользовательский
      // маршрут: плотность там задана демонстрационно.
      if (def.name === "design-system") continue;
      for (const width of MOBILE_WIDTHS) {
        await page.setViewportSize({ width, height: 800 });
        await openPage(page, def.path);
        const targets = await collectTouchTargets(page);
        for (const t of targets) {
          all.push({ page: def.name, width, ...t });
          if (t.w < 44 || t.h < 44) small.push({ page: def.name, width, ...t });
        }
      }
    }
    writeFileSync(
      `${ARTIFACTS}/reports/touch-targets.json`,
      JSON.stringify({ small, total: all.length }, null, 2),
    );
    // Уникальные нарушители (одна и та же кнопка на 4 ширинах = 1 запись)
    const label = (s: {
      page: string;
      tag: string;
      cls: string;
      name: string;
      w: number;
      h: number;
    }) => `${s.page}: ${s.tag}.${s.cls} "${s.name}" (${s.w}×${s.h})`;
    const unique = [...new Set(small.map(label))];
    expect(
      unique,
      `targets under 44x44 (${small.length} occurrences, details: touch-targets.json)`,
    ).toEqual([]);
  });
});

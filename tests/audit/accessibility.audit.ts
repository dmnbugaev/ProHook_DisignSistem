import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { ARTIFACTS, AUDIT_PAGES, ensureDir, openPage } from "./helpers";

// Автоматический a11y-аудит (axe-core): критичные нарушения
// (контраст, имена контролов, структура заголовков, aria).
// Ручные проверки клавиатуры — в functional.audit.ts.

/** Ждём завершения вступительных анимаций (hero-fade-up с fill: backwards):
 *  в полёте элементы полупрозрачны, и axe считает это нарушением контраста —
 *  хотя транзиентное состояние не является WCAG-дефектом. Замер делаем по
 *  устоявшемуся состоянию (opacity ≥ 0.99); без hero на странице — сразу. */
async function waitForIntroSettled(page: Page) {
  await page
    .waitForFunction(
      () =>
        [
          ...document.querySelectorAll(
            ".hero__intro, .hero__copy > .button, .hero__line-inner",
          ),
        ].every((el) => parseFloat(getComputedStyle(el).opacity) >= 0.99),
      undefined,
      { timeout: 3000 },
    )
    .catch(() => {});
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // Неактивные карточки промо-карусели — приглушённые дубликаты
    // (opacity 0.4, scale 0.87) для контраста осей «активная соседняя».
    // WCAG 1.4.3 освобождает inactive-компоненты; тот же контент
    // полностью читаем на активной карточке, которая замеряется.
    .exclude(".promo-card:not(.promo-card--active)")
    .analyze();
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
    count: v.nodes.length,
  }));
}

test.describe("accessibility audit", () => {
  ensureDir(`${ARTIFACTS}/reports`);

  // Замер в ветке prefers-reduced-motion: вступительные анимации и
  // scroll-reveal (data-reveal) держат элементы полупрозрачными, и axe
  // считает полупрозрачный текст нарушением контраста. Сайт корректно
  // поддерживает reduced-motion (всё показывается сразу) — аудитируем
  // устоявшееся состояние, заодно проверяя саму эту ветку.
  // test.use действует только на уровне объявления (внутри тела — no-op).
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("no critical axe violations on pages", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "audit-chromium") return;
    const violations: unknown[] = [];
    for (const def of AUDIT_PAGES) {
      await page.setViewportSize({ width: 390, height: 844 });
      await openPage(page, def.path);
      await waitForIntroSettled(page);
      const found = await axe(page);
      // Настольная ширина: та же страница в desktop-раскладке
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.evaluate(() => new Promise(requestAnimationFrame));
      found.push(...(await axe(page)));
      if (found.length) violations.push({ page: def.name, violations: found });
    }
    writeFileSync(
      `${ARTIFACTS}/reports/axe-violations.json`,
      JSON.stringify(violations, null, 2),
    );
    expect(
      violations,
      `axe violations (details: ${ARTIFACTS}/reports/axe-violations.json)`,
    ).toEqual([]);
  });

  test("modals trap focus and restore it on close", async ({ page }) => {
    await openPage(page, "/");
    // Мобильное меню
    await page.setViewportSize({ width: 390, height: 844 });
    const burger = page.locator(".menu-toggle, [aria-label*='меню' i]").first();
    await burger.click();
    const menu = page.getByRole("dialog");
    await expect(menu).toBeVisible();
    // Фокус внутри диалога; Tab циклится внутри
    for (let i = 0; i < 15; i++) await page.keyboard.press("Tab");
    const inDialog = await page.evaluate(
      () =>
        !!document.querySelector("dialog")?.contains(document.activeElement),
    );
    expect(inDialog).toBe(true);
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
    const restored = await page.evaluate(
      () => document.activeElement?.className?.toString() ?? "",
    );
    expect(restored.length).toBeGreaterThan(0);
  });
});

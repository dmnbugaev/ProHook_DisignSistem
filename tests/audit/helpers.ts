import type { Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Общие константы и хелпы аудиторских спек (tests/audit/*.audit.ts).

export const ARTIFACTS = resolve("test-artifacts");

export type PageDef = { path: string; name: string; gated?: boolean };

// Все пользовательские маршруты сайта (см. карту страниц в TEST_REPORT.md).
// gated — страницы, до контента которых нужен 18+-гейт.
export const AUDIT_PAGES: PageDef[] = [
  { path: "/", name: "home" },
  { path: "/catalog", name: "catalog", gated: true },
  { path: "/catalog/objects", name: "catalog-objects", gated: true },
  { path: "/catalog/stands", name: "catalog-stands", gated: true },
  { path: "/product/stands-01", name: "product", gated: true },
  {
    path: "/search?q=%D0%91%D0%BB%D0%BE%D0%BA%D0%BD%D0%BE%D1%82",
    name: "search",
    gated: true,
  },
  { path: "/stores", name: "stores" },
  { path: "/contacts", name: "contacts" },
  { path: "/about", name: "about" },
  { path: "/partners", name: "partners" },
  { path: "/information", name: "information" },
  { path: "/personal-data", name: "personal-data" },
  { path: "/privacy", name: "privacy" },
  { path: "/login", name: "login" },
  { path: "/register", name: "register" },
  // Аноним без сессии → /account редиректит на /login; /reserve с пустым
  // списком отбора показывает пустое состояние — оба состояния проверяем.
  { path: "/account", name: "account" },
  { path: "/reserve", name: "reserve" },
  { path: "/design-system", name: "design-system" },
];

// Cookie готового пользователя: возраст подтверждён, магазин выбран —
// чтобы страницы каталога рендерили контент, а не гейт/пикер.
export async function setUserCookies(page: Page) {
  await page.context().addCookies([
    {
      name: "prohook-age-confirmed",
      value: "true",
      domain: "127.0.0.1",
      path: "/",
    },
    { name: "prohook-store", value: "store-1", domain: "127.0.0.1", path: "/" },
  ]);
}

export async function openPage(page: Page, path: string) {
  await setUserCookies(page);
  await page.goto(path, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  // Дожидаемся окончания клиентских данных (изображения/асинхронные блоки)
  await page.waitForLoadState("networkidle").catch(() => {});
}

export function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

// Пул ширины viewport для свипа: мобильные 280–480 с мелким шагом,
// границы breakpoints и типовые планшетные/десктопные ширины.
export function sweepWidths(): number[] {
  const widths = new Set<number>();
  for (let w = 280; w <= 480; w += 8) widths.add(w);
  for (let w = 488; w <= 780; w += 32) widths.add(w);
  for (const w of [
    280, 320, 344, 359, 360, 374, 375, 376, 384, 389, 390, 393, 399, 402, 412,
    414, 424, 428, 430, 440, 568, 640, 768, 769, 810, 820, 834, 991, 1023, 1024,
    1025, 1180, 1194, 1280, 1366, 1440, 1536, 1600, 1920, 2560,
  ])
    widths.add(w);
  return [...widths].sort((a, b) => a - b);
}

// Инжект в страницу: сбор layout-дефектов. Выполняется в браузере.
// Возвращает:
//  - pageOverflow: документ шире viewport (реальный горизонтальный скролл)
//  - spill: видимые элементы, вылезающие за левый/правый край
//  - textClip: текст, обрезанный overflow-контейнером без ellipsis/scroll
export const LAYOUT_DEFECTS_SCRIPT = `
() => {
  const doc = document.documentElement;
  const vw = doc.clientWidth;
  const defects = { viewport: vw, pageOverflow: 0, spill: [], textClip: [] };

  const clipChainFits = (el) => {
    // Родитель с overflow:hidden/auto/scroll, сам помещающийся в viewport,
    // обрезает вылезающего ребёнка — тот невидим, не дефект.
    let p = el.parentElement;
    while (p && p !== document.body && p !== doc) {
      const s = getComputedStyle(p);
      if (["hidden", "clip", "auto", "scroll"].includes(s.overflowX)) {
        const r = p.getBoundingClientRect();
        if (r.right <= vw + 1 && r.left >= -1) return true;
      }
      p = p.parentElement;
    }
    return false;
  };

  const selector = "body *";
  for (const el of document.querySelectorAll(selector)) {
    // Экранные читалки: sr-only клипается по определению, не дефект
    if (el.classList.contains("sr-only") || el.closest(".sr-only")) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;

    const overRight = r.right - vw;
    const overLeft = -r.left;
    if ((overRight > 2 || overLeft > 2) && !clipChainFits(el)) {
      // Декоративные бегущие строки сами шире экрана — пропускаем трек,
      // обрезка контролируется в отдельной визуальной проверке.
      if (el.closest("[data-marquee], .marquee, .running-line")) continue;
      defects.spill.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.baseVal !== undefined
          ? el.className.baseVal : el.className || "").toString().slice(0, 120),
        id: el.id || undefined,
        text: (el.textContent || "").trim().slice(0, 60),
        left: Math.round(r.left), right: Math.round(r.right),
        w: Math.round(r.width), overRight: Math.round(overRight),
      });
    }

    // Обрезанный текст: контент шире бокса и теряется без следа.
    // Ellipsis — намеренный паттерн дизайна; отдельный сигнал — когда
    // эллипсис сжат настолько (<24px), что текст нечитаем.
    if (el.children.length === 0 && (el.textContent || "").trim()) {
      if (el.scrollWidth > el.clientWidth + 2) {
        const ox = cs.overflowX;
        if ((ox === "hidden" || ox === "clip") && cs.textOverflow !== "ellipsis") {
          defects.textClip.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || "").toString().slice(0, 120),
            text: (el.textContent || "").trim().slice(0, 60),
            client: el.clientWidth, scroll: el.scrollWidth,
          });
        } else if (
          cs.textOverflow === "ellipsis" &&
          el.clientWidth < 24
        ) {
          defects.textClip.push({
            severeEllipsis: true,
            tag: el.tagName.toLowerCase(),
            cls: (el.className || "").toString().slice(0, 120),
            text: (el.textContent || "").trim().slice(0, 60),
            client: el.clientWidth, scroll: el.scrollWidth,
          });
        }
      }
    }
  }

  defects.pageOverflow = doc.scrollWidth - vw;
  // Уникализируем spill: оставляем самые внешние (крупные) элементы
  defects.spill = defects.spill
    .sort((a, b) => (b.w - a.w))
    .slice(0, 12);
  return defects;
}`;

export async function collectLayoutDefects(page: Page) {
  return page.evaluate(`(${LAYOUT_DEFECTS_SCRIPT})()`);
}

// Аудит размеров touch-targets: видимые интерактивные элементы и их
// габариты (44×44 — ориентир Apple HIG). Вертикальная позиция не важна:
// цель должна быть крупной и ниже первого экрана.
export const TOUCH_TARGETS_SCRIPT = `
() => {
  const targets = [];
  const sel = "a[href], button, input, select, textarea, summary, " +
    "[role=button], [role=checkbox], [role=radio], [role=switch], [role=tab], [role=option]";
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest("[data-audit-skip-targets]")) continue;
    // Honeypot-поля и всё скрытое от AT не является пользовательской целью
    if (el.closest('[aria-hidden="true"], [inert]')) continue;
    // WCAG 2.5.8 исключения (не дефект, цель доступна):
    //  - чекбокс/радио внутри крупного label — цель весь label-ряд;
    //  - ссылки в потоке прозы (юридические тексты, дисклеймеры,
    //    контактные строки) — inline-исключение;
    //  - название товара в карточке — рядом есть эквивалентная цель
    //    того же перехода: вся площадь изображения карточки.
    if (/checkbox|radio/.test(el.type || "")) {
      const label = el.closest("label");
      if (label) {
        const lr = label.getBoundingClientRect();
        if (lr.width >= 40 && lr.height >= 40) continue;
      }
    }
    if (el.tagName === "A") {
      const s = getComputedStyle(el);
      if (s.display === "inline") {
        const parent = el.parentElement;
        if (
          parent &&
          parent.textContent.trim().length >
            (el.textContent || "").trim().length + 10
        )
          continue;
      }
      if (el.closest(
        ".legal-notice, .footer-note, .footer-disclaimer, " +
        ".footer-bottom__legal, .product-card__name",
      )) continue;
    }
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // Виртуальные клавиатуры/скрытые чекбоксы при кастомных контролах
    if (cs.position === "absolute" && (cs.clip !== "auto" && +cs.opacity === 0)) continue;
    const name = (el.getAttribute("aria-label") ||
      el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 50);
    targets.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || "").toString().slice(0, 100),
      name,
      w: Math.round(r.width), h: Math.round(r.height),
      x: Math.round(r.left), y: Math.round(r.top),
    });
  }
  return targets;
}`;

export async function collectTouchTargets(page: Page) {
  return page.evaluate(`(${TOUCH_TARGETS_SCRIPT})()`);
}

import { test, expect } from "@playwright/test";

// Блок «Акции и предложения» (промо-карусель, наполняется ботом): доступ
// только после 18+, карусель с автопрокруткой и индикатором, публичный API
// без служебных полей, вебхук бота закрыт секретом. Демо-карточки приходят
// из PROMO_SEED_DEMO=1 e2e-окружения; ключей бота в тестах нет — уведомления
// не отправляются.

const AGE_COOKIE = {
  name: "prohook-age-confirmed",
  value: "true",
  domain: "127.0.0.1",
  path: "/",
};
// Без магазина после подтверждения 18+ открывается диалог выбора точки —
// он перехватывает клики, поэтому заранее выбираем фикстурный магазин.
const STORE_COOKIE = {
  name: "prohook-store",
  value: "store-1",
  domain: "127.0.0.1",
  path: "/",
};

test("promos section is gated behind 18+ and rendered after confirmation", async ({
  page,
  request,
}) => {
  const bare = await request.get("/");
  expect(await bare.text()).not.toContain("Акции и предложения");

  await page.context().addCookies([AGE_COOKIE]);
  await page.goto("/");
  const section = page.locator(".promos");
  await expect(section).toBeVisible();
  // Карусель рендерит три копии списка — бесшовный цикл (конец → начало).
  await expect(section.locator(".promo-card")).toHaveCount(9);
});

test("carousel auto-advances every 10 seconds with progress indicator", async ({
  page,
}) => {
  await page.context().addCookies([AGE_COOKIE]);
  await page.goto("/");
  const activeCard = page.locator(".promo-card--active");
  await expect(activeCard).toHaveCount(1);
  const first = await activeCard.locator("h3").innerText();

  // Индикатор: по сегменту на карточку; активный заполняется.
  const segments = page.locator(".promos__segment");
  await expect(segments).toHaveCount(3);
  await expect(segments.first()).toBeVisible();

  // Автопрокрутка: через ~10 секунд активна следующая карточка.
  await expect
    .poll(async () => (await activeCard.locator("h3").innerText()) !== first, {
      timeout: 16000,
    })
    .toBe(true);
});

test("carousel arrows and segments switch cards manually", async ({ page }) => {
  await page.context().addCookies([AGE_COOKIE, STORE_COOKIE]);
  await page.goto("/");
  // Клик до окончания гидрации Vue теряется (особенность проекта, медленнее
  // всего в dev-режиме) — ждём завершения гидрации, как остальные спеки.
  await page.waitForFunction(() => {
    const root = document.getElementById("__nuxt") as
      | (HTMLElement & {
          __vue_app__?: { $nuxt?: { isHydrating: boolean } };
        })
      | null;
    return root?.__vue_app__?.$nuxt?.isHydrating === false;
  });
  const activeCard = page.locator(".promo-card--active");
  const initial = await activeCard.locator("h3").innerText();

  await page.getByRole("button", { name: "Следующая карточка" }).click();
  // Плавная прокрутка сменяет активную карточку не мгновенно — ждём смены.
  await expect
    .poll(async () => await activeCard.locator("h3").innerText(), {
      timeout: 8000,
    })
    .not.toBe(initial);

  // Сегмент-индикатор возвращает к первой карточке.
  await page.getByRole("tab", { name: /Карточка 1/ }).click({ force: true });
  await expect
    .poll(async () => await activeCard.locator("h3").innerText(), {
      timeout: 8000,
    })
    .toBe(initial);
});

test("public promos API exposes only display fields", async ({ request }) => {
  const payload = await (await request.get("/api/promos")).json();
  expect(payload.items.length).toBe(3);
  for (const item of payload.items) {
    expect(item.id).toBeTruthy();
    expect(item.title).toBeTruthy();
    // Разметка Telegram: безопасный HTML сгенерирован сервером.
    expect(item.titleHtml).toBeTruthy();
    expect(item.textHtml).toBeTruthy();
    expect(["photo", "sticker"]).toContain(item.mediaKind);
    expect(item).not.toHaveProperty("status");
    expect(item).not.toHaveProperty("order");
    expect(item).not.toHaveProperty("mediaFile");
    expect(item).not.toHaveProperty("mediaPosterFile");
    expect(item.ctaHref).toBe("/catalog");
  }
});

test("promos section renders Telegram formatting", async ({ page }) => {
  await page.context().addCookies([AGE_COOKIE]);
  await page.goto("/");
  // Демо-карточка №1 приходит с жирным и цитатой (лента показывает новые
  // карточки первыми, поэтому ищем по содержимому, а не по позиции).
  await expect(page.locator(".promo-card__text strong").first()).toBeVisible();
  await expect(
    page.locator(".promo-card__text blockquote").first(),
  ).toBeVisible();
  const formatted = page
    .locator(".promo-card__text", { hasText: "жирный" })
    .first();
  // Переносы строк и отступы сообщения показывает pre-wrap.
  await expect(formatted).toHaveCSS("white-space", "pre-wrap");
  // Заголовок с разметкой <strong> из titleHtml.
  await expect(page.locator(".promo-card h3 strong").first()).toBeVisible();
  // Ценник подсвечен красным (демо-карточка №1 — жёлтая, #c91400).
  const price = page.locator(".promo-card__text .tg-price").first();
  await expect(price).toBeVisible();
  await expect(price).toHaveCSS("color", "rgb(201, 20, 0)");
});

test("promo bot webhook rejects requests without secret", async ({
  request,
}) => {
  const response = await request.post("/api/telegram/promo/webhook", {
    data: { update_id: 1, message: { chat: { id: 1 }, text: "спам" } },
  });
  expect(response.status()).toBe(403);
});

test("promo image endpoint requires age confirmation", async ({ request }) => {
  const allowed = await request.get(
    "/api/promos/00000000-0000-0000-0000-000000000000/image",
    {
      headers: { cookie: "prohook-age-confirmed=true" },
    },
  );
  expect(allowed.status()).toBe(404);
  const bare = await request.get(
    "/api/promos/00000000-0000-0000-0000-000000000000/image",
  );
  expect(bare.status()).toBe(403);
});

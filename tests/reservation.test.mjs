/* global Response */
import { test } from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

// Свежие каталоги до импорта модулей: сторы читают env при импорте.
const dataDir = mkdtempSync(join(tmpdir(), "prohook-reservations-"));
process.env.RESERVATION_DATA_DIR = dataDir;
// Быстрые повторы доставки в тестах.
process.env.TELEGRAM_RETRY_DELAY_MS = "1";
// Резервный канал МойСклад в тестах отключён (в шелле разработчика могут
// быть экспортированы боевые NUXT_MOYSKLAD_TOKEN/MOYSKLAD_TOKEN).
process.env.NUXT_MOYSKLAD_TOKEN = "";
process.env.MOYSKLAD_TOKEN = "";
process.env.MOYSKLAD_NOTIFY_EMPLOYEE_ID = "";

const jiti = createJiti(import.meta.url);
const { validateReservation, normalizeSelectionItems } = await jiti.import(
  "../shared/utils/reservation.ts",
);
const { reservationCapForAvailability, RESERVATION_LIMITS } = await jiti.import(
  "../shared/types/reservation.ts",
);
const {
  parseReservationChatIds,
  buildReservationMessage,
  deliverReservationMessage,
  dispatchReservationNotification,
} = await jiti.import("../server/services/reservation-telegram.ts");
const {
  createReservation,
  findReservationByPublicId,
  reservationDailyIndex,
  resetReservationStoreForTests,
  RESERVATION_TTL_MS,
} = await jiti.import("../server/services/reservation-store.ts");
const { verifySmartCaptcha, isSmartCaptchaConfigured } = await jiti.import(
  "../server/services/smartcaptcha.ts",
);
const { allowReservation } = await jiti.import(
  "../server/utils/reservation-rate-limit.ts",
);
const { idempotentResult, rememberIdempotentResult } = await jiti.import(
  "../server/utils/idempotency.ts",
);
const { parseCatalogQuery } = await jiti.import(
  "../shared/utils/catalog-query.ts",
);

const validItems = [
  { productId: "stands-01", quantity: 2 },
  { productId: "chew-01", quantity: 1 },
];
const valid = {
  name: "Иван Петров",
  phone: "+7 999 123-45-67",
  storeId: "store-2",
  comment: "",
  consent: true,
  consentTelegram: true,
  items: validItems,
};

const storedReservation = () => ({
  id: "4f2a2b0e-6f2e-4d0a-9d4b-1c2d3e4f5a6b",
  publicId: "R-AB3DK9",
  userId: null,
  customerName: "Иван Петров",
  phone: "79991234567",
  storeId: "store-2",
  storeNameSnapshot: "Студия · Север",
  storeAddressSnapshot: "ул. Примерная, 1",
  status: "PENDING",
  createdAt: "2026-10-07T11:33:00.000Z",
  updatedAt: "2026-10-07T11:33:00.000Z",
  expiresAt: "2026-10-08T11:33:00.000Z",
  comment: "Приду вечером",
  consent: {
    personalData: true,
    telegram: true,
    capturedAt: "2026-10-07T11:33:00.000Z",
  },
  captchaVerifiedAt: null,
  items: [
    {
      productId: "stands-01",
      productNameSnapshot: "Подставка 01",
      quantity: 2,
    },
    {
      productId: "chew-01",
      productNameSnapshot: "Паучи тестовые 4 мг",
      quantity: 1,
    },
  ],
  telegramDelivery: { attempts: 0, deliveredTo: [], lastAttemptAt: null },
});

test("validates reservation form and ignores unknown fields (no mass assignment)", () => {
  const { data, errors, valid: ok } = validateReservation(valid);
  assert.equal(ok, true);
  assert.deepEqual(errors, {});
  assert.equal(data.phone, "79991234567");
  // Клиент не может протащить chat_id, текст сообщения, цену или статус.
  const hostile = validateReservation({
    ...valid,
    chatId: "123",
    chat_ids: ["123"],
    message: "Своё сообщение",
    text: "Своё сообщение",
    status: "CONFIRMED",
    publicId: "R-000000",
    price: 1,
    priceSnapshot: 1,
  });
  assert.equal(hostile.valid, true);
  assert.equal("chatId" in hostile.data, false);
  assert.equal("message" in hostile.data, false);
  assert.equal("status" in hostile.data, false);
  assert.equal("price" in hostile.data, false);
});

test("rejects invalid names, phones, stores, consents and control characters", () => {
  for (const body of [
    null,
    [],
    {},
    { ...valid, name: "И" },
    { ...valid, name: "Иван\nПетров" },
    { ...valid, name: "x".repeat(81) },
    { ...valid, phone: "123" },
    { ...valid, storeId: "../etc/passwd" },
    { ...valid, comment: "невидимый\u0001символ" },
    { ...valid, consent: "true" },
    { ...valid, consentTelegram: false },
    { ...valid, items: [] },
    { ...valid, items: [{ productId: "bad id!", quantity: 1 }] },
    { ...valid, items: [{ productId: "stands-01", quantity: 0 }] },
  ]) {
    assert.equal(validateReservation(body).valid, false);
  }
});

test("collapses comment whitespace and merges duplicate items within limits", () => {
  const { data, errors } = validateReservation({
    ...valid,
    comment: "  Приду   вечером,\nесли    удобно ",
    items: [
      { productId: "stands-01", quantity: 2 },
      { productId: "stands-01", quantity: 1 },
      { productId: "chew-01", quantity: 1 },
    ],
  });
  assert.deepEqual(errors, {});
  assert.equal(data.comment, "Приду вечером, если удобно");
  assert.deepEqual(data.items, [
    { productId: "chew-01", quantity: 1 },
    { productId: "stands-01", quantity: 3 },
  ]);
  // Лимиты: позиций и суммарного количества.
  assert.equal(
    validateReservation({
      ...valid,
      items: Array.from(
        { length: RESERVATION_LIMITS.maxItems + 1 },
        (_, i) => ({
          productId: `p${i}`,
          quantity: 1,
        }),
      ),
    }).valid,
    false,
  );
  assert.equal(
    validateReservation({
      ...valid,
      items: Array.from({ length: 5 }, (_, i) => ({
        productId: `q${i}`,
        quantity: 10,
      })),
    }).valid,
    false,
  );
});

test("normalizeSelectionItems merges duplicates, keeps totals and drops garbage", () => {
  // Количество не обрезается молча: лимиты проверяет validateReservation.
  assert.deepEqual(
    normalizeSelectionItems([
      { productId: "a", quantity: 99 },
      { productId: "a", quantity: 5 },
      "мусор",
      { productId: "b", quantity: 1.5 },
    ]),
    [{ productId: "a", quantity: 104 }],
  );
  assert.equal(normalizeSelectionItems([]), null);
  assert.equal(normalizeSelectionItems("nope"), null);
});

test("availability buckets cap reservation quantity conservatively", () => {
  assert.equal(reservationCapForAvailability("plenty"), 10);
  assert.equal(reservationCapForAvailability("available"), 10);
  assert.equal(reservationCapForAvailability("low"), 3);
  assert.equal(reservationCapForAvailability("unknown"), 3);
  assert.equal(reservationCapForAvailability("unavailable"), 0);
});

test("parses and validates the reservation chat id allowlist", () => {
  assert.deepEqual(
    parseReservationChatIds(
      "6939112736, 1107248048 ,5313920922,8562692667,6939112736",
    ),
    ["6939112736", "1107248048", "5313920922", "8562692667"],
  );
  assert.deepEqual(parseReservationChatIds("@evil,abc,-100,, ,https://x"), []);
  assert.deepEqual(parseReservationChatIds(undefined), []);
});

test("message is plain text with required fields and no commerce wording", () => {
  const text = buildReservationMessage(storedReservation(), 5);
  for (const expected of [
    "Новый запрос на резерв",
    "Номер: R-AB3DK9",
    "Студия · Север",
    "ул. Примерная, 1",
    "Имя: Иван Петров",
    "Телефон: +7 999 123-45-67",
    "1. Подставка 01\nКоличество: 2 шт.",
    "2. Паучи тестовые 4 мг\nКоличество: 1 шт.",
    "Комментарий:\nПриду вечером",
    "Статус:\nОжидает обработки",
    // Юридическую приписку заменила нумерация за день (решение 10.11.2026).
    "Заявка №5 за день · Саратов",
  ])
    assert.ok(text.includes(expected), `missing: ${expected}`);
  // Запрещённая терминология дистанционной продажи.
  for (const forbidden of ["Новый заказ", "Заказ оформлен", "купил", "оплачен"])
    assert.ok(!text.includes(forbidden), `forbidden: ${forbidden}`);
});

test("daily index line numbers the request within its Saratov day", () => {
  // Решение 10.11.2026: юридическая приписка заменена нумерацией за день —
  // день и номер по времени Саратова (МСК+1), время в обоих поясах
  // (магазины в Саратове и Москве).
  const text = buildReservationMessage(storedReservation(), 3);
  assert.ok(
    text.includes("Заявка №3 за день · Саратов 07.10.2026, 15:33 (МСК 14:33)"),
  );
  assert.ok(!text.includes("онлайн-оплаты и доставки нет"));
  // Без номера (номер не вычислен) строка не добавляется вовсе.
  assert.ok(!buildReservationMessage(storedReservation()).includes("Заявка №"));
});

test("daily index counts requests per Saratov calendar day", async () => {
  // Саратов = МСК+1: заявка в 23:30 МСК 09.11 уже принадлежит
  // саратовскому дню 10.11 — нумерация следует саратовской границе.
  const make = (customerName, phone = "79991234567", monitorProbe = false) =>
    createReservation({
      userId: null,
      customerName,
      phone,
      storeId: "store-2",
      storeNameSnapshot: "Студия · Север",
      storeAddressSnapshot: "",
      comment: "",
      consent: { personalData: true, telegram: true },
      captchaVerifiedAt: null,
      items: [
        {
          productId: "stands-01",
          productNameSnapshot: "Подставка 01",
          quantity: 1,
        },
      ],
      monitorProbe,
    });
  const first = await make("День Саратов 1");
  const second = await make("День Саратов 2");
  // Проба монитор-бота с флагом (создаётся так с 10.11.2026)…
  const probe = await make("ТЕСТ Мониторинг", "79990000000", true);
  // …и легаси-проба без флага — как записи до деплоя 10.11: распознаётся
  // по маркерам (имя «ТЕСТ Мониторинг» + служебный телефон).
  const legacyProbe = await make("ТЕСТ Мониторинг", "79990000000", false);
  const joker = await make("ТЕСТ Мониторинг"); // реальный клиент-шутник
  const third = await make("День Саратов 3");
  const file = join(dataDir, "reservations.json");
  const data = JSON.parse(readFileSync(file, "utf8"));
  const byId = (id) => data.requests.find((item) => item.id === id);
  byId(first.id).createdAt = "2026-11-09T19:00:00.000Z"; // САР 09.11 23:00
  byId(second.id).createdAt = "2026-11-09T19:30:00.000Z"; // САР 09.11 23:30
  byId(probe.id).createdAt = "2026-11-09T19:45:00.000Z"; // САР 09.11 23:45
  byId(legacyProbe.id).createdAt = "2026-11-09T19:50:00.000Z"; // САР 09.11 23:50
  byId(joker.id).createdAt = "2026-11-09T19:55:00.000Z"; // САР 09.11 23:55
  byId(third.id).createdAt = "2026-11-09T20:30:00.000Z"; // САР 10.11 00:30
  writeFileSync(file, JSON.stringify(data));
  resetReservationStoreForTests();

  // Индекс считается по перечитанным записям (снятки из createReservation
  // держат старый createdAt).
  const reloaded = (publicId) => findReservationByPublicId(publicId);
  assert.equal(await reservationDailyIndex(await reloaded(first.publicId)), 1);
  // Обе пробы между second и joker не сдвигают нумерацию; клиент-шутник
  // с тем же именем, но обычным телефоном — реальная заявка.
  assert.equal(await reservationDailyIndex(await reloaded(second.publicId)), 2);
  assert.equal(await reservationDailyIndex(await reloaded(joker.publicId)), 3);
  // Новый саратовский день — хотя московский всё ещё 09.11.
  assert.equal(await reservationDailyIndex(await reloaded(third.publicId)), 1);
});

test("message cannot be forged with extra lines via user input", () => {
  const hostile = storedReservation();
  hostile.customerName = "Иван\nНомер: R-000000";
  hostile.comment = "комментарий\nСтатус: Подтверждён";
  hostile.items[0].productNameSnapshot = "Товар\nТелефон: +7 000";
  const text = buildReservationMessage(hostile);
  // Пользовательские переносы не создают новых строк сообщения.
  assert.ok(!text.includes("Иван\nНомер"));
  assert.ok(!/\nСтатус: Подтверждён/.test(text));
  assert.ok(!text.includes("Товар\nТелефон"));
  assert.ok(text.includes("Имя: Иван Номер: R-000000"));
  assert.ok(text.includes("Комментарий:\nкомментарий Статус: Подтверждён"));
});

test("delivers to all four allowlisted chats as plain text", async () => {
  const chats = [];
  const { deliveredTo } = await deliverReservationMessage(
    "fake-token",
    ["6939112736", "1107248048", "5313920922", "8562692667"],
    "text",
    async (url, options) => {
      assert.equal(url, "https://api.telegram.org/botfake-token/sendMessage");
      const body = JSON.parse(options.body);
      chats.push(body.chat_id);
      assert.equal(body.parse_mode, undefined);
      assert.equal(body.link_preview_options.is_disabled, true);
      return new Response(
        JSON.stringify({ ok: true, result: { message_id: 1 } }),
      );
    },
  );
  assert.deepEqual(chats, [
    "6939112736",
    "1107248048",
    "5313920922",
    "8562692667",
  ]);
  assert.deepEqual(deliveredTo, chats);
});

test("survives Telegram 429, 5xx, timeout and network errors per chat", async () => {
  const chatIds = ["1", "2", "3", "4"];
  const responders = [
    () => new Response('{"ok":false,"error_code":429}', { status: 429 }),
    () => new Response("bad gateway", { status: 502 }),
    (url, options) =>
      new Promise((_, reject) => {
        // Симуляция таймаута: обещание отвергается по abort-сигналу запроса.
        options.signal.addEventListener("abort", () =>
          reject(new Error("TimeoutError")),
        );
        options.signal.abort();
      }),
    () => Promise.reject(new Error("network")),
  ];
  const { deliveredTo } = await deliverReservationMessage(
    "fake-token",
    chatIds,
    "text",
    async (url, options) =>
      responders[chatIds.indexOf(JSON.parse(options.body).chat_id)](
        url,
        options,
      ),
  );
  assert.deepEqual(deliveredTo, []);
  // Частичная доставка: живой чат получает сообщение, недоступные — нет.
  const partial = await deliverReservationMessage(
    "fake-token",
    chatIds,
    "text",
    async (url, options) => {
      const { chat_id } = JSON.parse(options.body);
      return chat_id === "3"
        ? new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }))
        : new Response('{"ok":false}');
    },
  );
  assert.deepEqual(partial.deliveredTo, ["3"]);
});

test("classifies fatal chat rejections (chat not found / blocked)", async () => {
  // Диагностика 10.11.2026: чат allowlist, чей владелец не нажимал /start,
  // отвечает 400 «chat not found» на каждую отправку. Такой чат фатален —
  // ретраи в него бессмысленны и раньше тихо сжигали 160 попыток свипера.
  const report = await deliverReservationMessage(
    "fake-token",
    ["111", "222", "333"],
    "text",
    async (url, options) => {
      const chatId = JSON.parse(options.body).chat_id;
      if (chatId === "111")
        return new Response(
          '{"ok":false,"error_code":400,"description":"Bad Request: chat not found"}',
        );
      if (chatId === "222")
        return new Response(
          '{"ok":false,"error_code":403,"description":"Forbidden: bot was blocked by the user"}',
        );
      return new Response(
        JSON.stringify({ ok: true, result: { message_id: 1 } }),
      );
    },
  );
  assert.deepEqual(report.deliveredTo, ["333"]);
  assert.deepEqual(
    report.fatalTo.map((entry) => entry.chatId),
    ["111", "222"],
  );
  assert.match(report.fatalTo[0].description, /chat not found/);
  // Проходящие отказы (429, 5xx) фатальными не считаются — флап лечится повтором.
  const transient = await deliverReservationMessage(
    "fake-token",
    ["111"],
    "text",
    async () => new Response('{"ok":false,"error_code":429}', { status: 429 }),
  );
  assert.deepEqual(transient.deliveredTo, []);
  assert.deepEqual(transient.fatalTo, []);
});

test("dispatch retries until every chat is covered, without duplicates", async () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChats = process.env.TELEGRAM_RESERVATION_CHAT_IDS;
  const originalFetch = globalThis.fetch;
  process.env.TELEGRAM_BOT_TOKEN = "fake-token";
  process.env.TELEGRAM_RESERVATION_CHAT_IDS = "111,222";
  try {
    const created = await createReservation({
      userId: null,
      customerName: "Иван Петров",
      phone: "79991234567",
      storeId: "store-2",
      storeNameSnapshot: "Студия · Север",
      storeAddressSnapshot: "",
      comment: "",
      consent: { personalData: true, telegram: true },
      captchaVerifiedAt: null,
      items: [
        {
          productId: "stands-01",
          productNameSnapshot: "Подставка 01",
          quantity: 1,
        },
      ],
    });
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response('{"ok":false}');
    };
    // Доставка не бросает исключение даже при полном отказе Telegram…
    await dispatchReservationNotification(created);
    assert.equal(calls, 16); // 8 попыток × 2 чата
    const stored = await findReservationByPublicId(created.publicId);
    assert.equal(stored.telegramDelivery.attempts, 8);
    assert.deepEqual(stored.telegramDelivery.deliveredTo, []);
    assert.equal(stored.status, "PENDING"); // запрос не потерян и не изменён
    // …и добирает недоставленный чат: частичный успех — не остановка.
    calls = 0;
    const sentTo = [];
    let chat222Calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      const chatId = JSON.parse(options.body).chat_id;
      sentTo.push(chatId);
      // Флап: чат 222 проходит только со второго к нему обращения.
      if (chatId === "222") chat222Calls++;
      const ok = chatId === "111" || chat222Calls >= 2;
      return ok
        ? new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }))
        : new Response('{"ok":false}');
    };
    await dispatchReservationNotification(created);
    // Попытка 1: оба чата (111 ок, 222 нет), попытка 2: только 222.
    assert.equal(calls, 3);
    assert.deepEqual(sentTo, ["111", "222", "222"]);
    const after = await findReservationByPublicId(created.publicId);
    assert.equal(after.telegramDelivery.attempts, 10);
    assert.deepEqual(after.telegramDelivery.deliveredTo, ["111", "222"]);
  } finally {
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    process.env.TELEGRAM_RESERVATION_CHAT_IDS = originalChats;
    globalThis.fetch = originalFetch;
  }
});

test("dispatch keeps retrying through network-level errors (flap)", async () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChats = process.env.TELEGRAM_RESERVATION_CHAT_IDS;
  const originalFetch = globalThis.fetch;
  process.env.TELEGRAM_BOT_TOKEN = "fake-token";
  process.env.TELEGRAM_RESERVATION_CHAT_IDS = "111,222";
  try {
    const created = await createReservation({
      userId: null,
      customerName: "Сеть флапает",
      phone: "79991234567",
      storeId: "store-2",
      storeNameSnapshot: "Студия · Север",
      storeAddressSnapshot: "",
      comment: "",
      consent: { personalData: true, telegram: true },
      captchaVerifiedAt: null,
      items: [
        {
          productId: "stands-01",
          productNameSnapshot: "Подставка 01",
          quantity: 1,
        },
      ],
    });
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new TypeError("fetch failed");
    };
    await dispatchReservationNotification(created);
    // Раньше сетевая ошибка обрывала ретраи — при флапе туннеля это
    // теряло уведомление; теперь проходятся все попытки.
    assert.equal(calls, 16);
    const stored = await findReservationByPublicId(created.publicId);
    assert.equal(stored.telegramDelivery.attempts, 8);
    assert.deepEqual(stored.telegramDelivery.deliveredTo, []);
  } finally {
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    process.env.TELEGRAM_RESERVATION_CHAT_IDS = originalChats;
    globalThis.fetch = originalFetch;
  }
});

test("dispatch stops retrying fatally rejected chats", async () => {
  // Регрессия 10.11.2026: чат allowlist с 400 «chat not found» раньше
  // ретраился впустую все 5 попыток (и ещё 160 циклов свипера) — теперь
  // фатальный чат фиксируется в хранилище и исключается из повторов.
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChats = process.env.TELEGRAM_RESERVATION_CHAT_IDS;
  const originalFetch = globalThis.fetch;
  process.env.TELEGRAM_BOT_TOKEN = "fake-token";
  process.env.TELEGRAM_RESERVATION_CHAT_IDS = "111,222";
  try {
    const created = await createReservation({
      userId: null,
      customerName: "Фатальный чат",
      phone: "79991234567",
      storeId: "store-2",
      storeNameSnapshot: "Студия · Север",
      storeAddressSnapshot: "",
      comment: "",
      consent: { personalData: true, telegram: true },
      captchaVerifiedAt: null,
      items: [
        {
          productId: "stands-01",
          productNameSnapshot: "Подставка 01",
          quantity: 1,
        },
      ],
    });
    const sentTo = [];
    globalThis.fetch = async (url, options) => {
      const chatId = JSON.parse(options.body).chat_id;
      sentTo.push(chatId);
      return chatId === "111"
        ? new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }))
        : new Response(
            '{"ok":false,"error_code":400,"description":"Bad Request: chat not found"}',
          );
    };
    await dispatchReservationNotification(created);
    // Одна попытка в каждый чат: живой доставлен, фатальный исключён
    // из повторов (старое поведение — 5×2 = 10 вызовов).
    assert.deepEqual(sentTo, ["111", "222"]);
    const stored = await findReservationByPublicId(created.publicId);
    assert.deepEqual(stored.telegramDelivery.deliveredTo, ["111"]);
    assert.deepEqual(stored.telegramDelivery.fatalTo, ["222"]);
    assert.equal(stored.telegramDelivery.attempts, 1);
  } finally {
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    process.env.TELEGRAM_RESERVATION_CHAT_IDS = originalChats;
    globalThis.fetch = originalFetch;
  }
});

test("dispatch is a no-op without a configured bot (dev and e2e mode)", async () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChats = process.env.TELEGRAM_RESERVATION_CHAT_IDS;
  const originalFetch = globalThis.fetch;
  process.env.TELEGRAM_BOT_TOKEN = "";
  process.env.TELEGRAM_RESERVATION_CHAT_IDS = "";
  let called = 0;
  globalThis.fetch = async () => {
    called++;
    return new Response("{}");
  };
  try {
    await dispatchReservationNotification(storedReservation());
    assert.equal(called, 0);
  } finally {
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    process.env.TELEGRAM_RESERVATION_CHAT_IDS = originalChats;
    globalThis.fetch = originalFetch;
  }
});

test("reservation store creates PENDING requests with public ids and expiry", async () => {
  const created = await createReservation({
    userId: "user-1",
    customerName: "Иван Петров",
    phone: "79991234567",
    storeId: "store-2",
    storeNameSnapshot: "Студия · Север",
    storeAddressSnapshot: "ул. Примерная, 1",
    comment: "Вечером",
    consent: { personalData: true, telegram: true },
    captchaVerifiedAt: "2026-10-07T11:00:00.000Z",
    items: [
      {
        productId: "stands-01",
        productNameSnapshot: "Подставка 01",
        quantity: 2,
      },
    ],
  });
  assert.match(created.publicId, /^R-[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(created.status, "PENDING");
  assert.equal(
    Date.parse(created.expiresAt) - Date.parse(created.createdAt),
    RESERVATION_TTL_MS,
  );
  assert.equal(
    (await findReservationByPublicId(created.publicId))?.id,
    created.id,
  );
  assert.equal(await findReservationByPublicId("R-NOPE1"), undefined);
});

test("store sweeps expired requests and old personal data on write", async () => {
  // Подготовленный файл: просроченный PENDING и запись старше срока хранения.
  const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const expired = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    join(dataDir, "reservations.json"),
    JSON.stringify({
      version: 1,
      requests: [
        {
          ...storedReservation(),
          id: "old-1",
          publicId: "R-OLD111",
          createdAt: old,
          expiresAt: old,
        },
        {
          ...storedReservation(),
          id: "expired-1",
          publicId: "R-EXP111",
          createdAt: expired,
          expiresAt: expired,
        },
      ],
    }),
  );
  // Модуль уже загружен с этим каталогом и перечитает файл после правки.
  const { resetReservationStoreForTests } = await jiti.import(
    "../server/services/reservation-store.ts",
  );
  resetReservationStoreForTests();
  await createReservation({
    userId: null,
    customerName: "Тест",
    phone: "79990000000",
    storeId: "store-1",
    storeNameSnapshot: "С",
    storeAddressSnapshot: "",
    comment: "",
    consent: { personalData: true, telegram: true },
    captchaVerifiedAt: null,
    items: [],
  });
  const stored = JSON.parse(
    readFileSync(join(dataDir, "reservations.json"), "utf8"),
  );
  assert.equal(
    stored.requests.some((item) => item.id === "old-1"),
    false,
  );
  assert.equal(
    stored.requests.find((item) => item.id === "expired-1")?.status,
    "EXPIRED",
  );
});

test("smartcaptcha: server-side verification only, failures never pass", async () => {
  const originalKey = process.env.SMARTCAPTCHA_SERVER_KEY;
  process.env.SMARTCAPTCHA_SERVER_KEY = "server-key";
  try {
    assert.equal(isSmartCaptchaConfigured(), true);
    const urls = [];
    assert.equal(
      await verifySmartCaptcha("token-1", "127.0.0.1", async (url, options) => {
        urls.push([url, JSON.parse(options.body)]);
        return new Response(JSON.stringify({ status: "ok" }));
      }),
      true,
    );
    assert.equal(urls[0][0], "https://smartcaptcha.yandexcloud.net/validate");
    assert.deepEqual(urls[0][1], {
      secret: "server-key",
      token: "token-1",
      ip: "127.0.0.1",
    });
    for (const respond of [
      () => new Response(JSON.stringify({ status: "failed" })),
      () => new Response("error", { status: 403 }),
      () => Promise.reject(new Error("network")),
      (url, options) =>
        new Promise((_, reject) => {
          options.signal.addEventListener("abort", () =>
            reject(new Error("timeout")),
          );
          options.signal.abort();
        }),
    ])
      assert.equal(await verifySmartCaptcha("t", undefined, respond), false);
  } finally {
    process.env.SMARTCAPTCHA_SERVER_KEY = originalKey;
  }
  // Без серверного ключа капча не настроена — но и проверка не пройдена.
  delete process.env.SMARTCAPTCHA_SERVER_KEY;
  assert.equal(isSmartCaptchaConfigured(), false);
  assert.equal(
    await verifySmartCaptcha(
      "t",
      undefined,
      async () => new Response('{"status":"ok"}'),
    ),
    false,
  );
});

test("rate limiter applies a default window and honors the env override", () => {
  const original = process.env.RESERVATION_RATE_LIMIT_MAX;
  try {
    delete process.env.RESERVATION_RATE_LIMIT_MAX;
    for (let i = 0; i < 5; i++)
      assert.equal(allowReservation("ip-a", 1000), true);
    assert.equal(allowReservation("ip-a", 1000), false);
    process.env.RESERVATION_RATE_LIMIT_MAX = "2";
    assert.equal(allowReservation("ip-b", 1000), true);
    assert.equal(allowReservation("ip-b", 1000), true);
    assert.equal(allowReservation("ip-b", 1000), false);
    assert.equal(allowReservation("ip-b", 901001), true);
  } finally {
    process.env.RESERVATION_RATE_LIMIT_MAX = original;
  }
});

test("idempotency cache replays the stored result within its TTL", () => {
  const now = Date.now();
  assert.equal(idempotentResult("key-12345678", now), null);
  rememberIdempotentResult("key-12345678", "R-AA1111", now);
  assert.equal(idempotentResult("key-12345678", now), "R-AA1111");
  assert.equal(
    idempotentResult("key-12345678", now + 15 * 60 * 1000 + 1),
    null,
  );
});

test("catalog query accepts bounded id lists for the selection page", () => {
  assert.deepEqual(parseCatalogQuery({ ids: "a,b ,c" }).ids, ["a", "b", "c"]);
  assert.deepEqual(parseCatalogQuery({ ids: "x,,bad id!,y" }).ids, ["x", "y"]);
  assert.deepEqual(
    parseCatalogQuery({
      ids: Array.from({ length: 30 }, (_, i) => `id${i}`).join(","),
    }).ids.length,
    24,
  );
  assert.equal(parseCatalogQuery({}).ids, undefined);
  assert.equal(parseCatalogQuery({ ids: "" }).ids, undefined);
});

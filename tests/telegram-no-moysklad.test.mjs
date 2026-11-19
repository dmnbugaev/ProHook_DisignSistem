/* global Response */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { createJiti } from "jiti";

// Решение владельца 19.11.2026: задачи в МойСклад из заявок не создаются
// НИКОГДА — ни при сетевой недоставке (флап туннеля), ни при фатальных
// отказах чатов, ни без конфигурации Telegram. Каналы уведомлений: бот
// @prohook_bunker_site_bot + инбокс /api/staff/inbox. Регрессия 19.11:
// фолбэк создавал задачу при 0 подтверждённых доставок, а свипер позже
// доставлял заявку в бот — заказ оказывался в обоих каналах.

// Свежий каталог стора до импорта модулей: стор читает env при импорте.
const reservationDir = mkdtempSync(join(tmpdir(), "prohook-reservations-nms-"));
process.env.RESERVATION_DATA_DIR = reservationDir;
process.env.TELEGRAM_RETRY_DELAY_MS = "1";
delete process.env.TELEGRAM_SILENT;

const jiti = createJiti(import.meta.url);
const { dispatchReservationNotification } = await jiti.import(
  "../server/services/reservation-telegram.ts",
);
const { createReservation, listReservations } = await jiti.import(
  "../server/services/reservation-store.ts",
);

function reservationInput(customerName) {
  return {
    userId: null,
    customerName,
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
  };
}

function okResponse() {
  return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }));
}

/** Фетч-заглушка: МойСклад считает вызовы (их быть не должно вообще). */
function fetchStub(counters, telegramBehavior) {
  return async (url, options) => {
    const u = String(url);
    if (u.includes("api.moysklad.ru")) {
      counters.moysklad += 1;
      return new Response("{}", { status: 200 });
    }
    return telegramBehavior(u, options);
  };
}

function withTelegramEnv(run) {
  const saved = {
    token: process.env.TELEGRAM_BOT_TOKEN,
    chatIds: process.env.TELEGRAM_RESERVATION_CHAT_IDS,
  };
  process.env.TELEGRAM_BOT_TOKEN = "fake-token";
  process.env.TELEGRAM_RESERVATION_CHAT_IDS = "111,222";
  return Promise.resolve(run()).finally(() => {
    process.env.TELEGRAM_BOT_TOKEN = saved.token ?? "";
    process.env.TELEGRAM_RESERVATION_CHAT_IDS = saved.chatIds ?? "";
  });
}

async function storedReservation(id) {
  const list = await listReservations(10);
  return list.find((item) => item.id === id);
}

test("сетевая недоставка — задачи в МойСклад нет", async () => {
  await withTelegramEnv(async () => {
    const counters = { moysklad: 0 };
    const savedFetch = globalThis.fetch;
    // Telegram недоступен на сетевом уровне (флап туннеля): заявка
    // остаётся в хранилище и инбоксе, добирается свипером.
    globalThis.fetch = fetchStub(counters, async () => {
      throw new Error("network down");
    });
    try {
      const reservation = await createReservation(
        reservationInput("Сетевой сбой"),
      );
      await dispatchReservationNotification(reservation, globalThis.fetch);

      const stored = await storedReservation(reservation.id);
      assert.equal(stored.telegramDelivery.deliveredTo.length, 0);
      assert.equal(stored.telegramDelivery.attempts, 8);
      assert.equal(counters.moysklad, 0);
    } finally {
      globalThis.fetch = savedFetch;
    }
  });
});

test("фатальный отказ всех чатов — задачи в МойСклад нет", async () => {
  await withTelegramEnv(async () => {
    const counters = { moysklad: 0 };
    const savedFetch = globalThis.fetch;
    // Все чаты отвечают 403: Telegram не примет сообщение никогда —
    // заявка остаётся в инбоксе, МойСклад не задействуется.
    globalThis.fetch = fetchStub(
      counters,
      async () =>
        new Response(
          '{"ok":false,"error_code":403,"description":"Forbidden: bot was blocked by the user"}',
        ),
    );
    try {
      const reservation = await createReservation(
        reservationInput("Фатальный чат"),
      );
      await dispatchReservationNotification(reservation, globalThis.fetch);

      const stored = await storedReservation(reservation.id);
      assert.equal(stored.telegramDelivery.deliveredTo.length, 0);
      assert.deepEqual(stored.telegramDelivery.fatalTo, ["111", "222"]);
      assert.equal(counters.moysklad, 0);
    } finally {
      globalThis.fetch = savedFetch;
    }
  });
});

test("частичная доставка — задачи в МойСклад нет", async () => {
  await withTelegramEnv(async () => {
    const counters = { moysklad: 0 };
    const savedFetch = globalThis.fetch;
    // Чат 111 получает сообщение, 222 отвечает 403.
    globalThis.fetch = fetchStub(counters, async (u, options) => {
      const chatId = JSON.parse(options.body).chat_id;
      return chatId === "111"
        ? okResponse()
        : new Response(
            '{"ok":false,"error_code":403,"description":"Forbidden: bot was blocked by the user"}',
          );
    });
    try {
      const reservation = await createReservation(
        reservationInput("Частичная доставка"),
      );
      await dispatchReservationNotification(reservation, globalThis.fetch);

      const stored = await storedReservation(reservation.id);
      assert.deepEqual(stored.telegramDelivery.deliveredTo, ["111"]);
      assert.deepEqual(stored.telegramDelivery.fatalTo, ["222"]);
      assert.equal(counters.moysklad, 0);
    } finally {
      globalThis.fetch = savedFetch;
    }
  });
});

test("без конфигурации Telegram — задачи в МойСклад нет", async () => {
  await withTelegramEnv(async () => {
    process.env.TELEGRAM_BOT_TOKEN = "";
    const counters = { moysklad: 0 };
    const savedFetch = globalThis.fetch;
    globalThis.fetch = fetchStub(counters, async () => okResponse());
    try {
      const reservation = await createReservation(
        reservationInput("Без Telegram"),
      );
      await dispatchReservationNotification(reservation, globalThis.fetch);

      const stored = await storedReservation(reservation.id);
      assert.equal(stored.telegramDelivery.attempts, 0);
      assert.equal(counters.moysklad, 0);
    } finally {
      globalThis.fetch = savedFetch;
    }
  });
});

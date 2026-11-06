/* global Response */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { createJiti } from "jiti";

// Свежие каталоги обоих сторов до импорта модулей: сторы читают env при
// импорте. Быстрые повторы и отключённый МойСклад — как в соседних тестах.
const partnershipDir = mkdtempSync(join(tmpdir(), "prohook-partnership-rd-"));
const reservationDir = mkdtempSync(join(tmpdir(), "prohook-reservations-rd-"));
process.env.PARTNERSHIP_DATA_DIR = partnershipDir;
process.env.RESERVATION_DATA_DIR = reservationDir;
process.env.TELEGRAM_RETRY_DELAY_MS = "1";
process.env.NUXT_MOYSKLAD_TOKEN = "";
process.env.MOYSKLAD_TOKEN = "";
process.env.MOYSKLAD_NOTIFY_EMPLOYEE_ID = "";

const jiti = createJiti(import.meta.url);
const { redeliverIncompleteTelegram } = await jiti.import(
  "../server/services/telegram-redelivery.ts",
);
const { createPartnership, listPartnerships, recordPartnershipAttempt } =
  await jiti.import("../server/services/partnership-store.ts");
const {
  createReservation,
  listReservations,
  recordTelegramAttempt,
  resetReservationStoreForTests,
} = await jiti.import("../server/services/reservation-store.ts");

const channels = {
  partnershipToken: "fake-token",
  partnershipChatIds: ["-123", "-456"],
  reservationToken: "fake-token",
  reservationChatIds: ["111", "222"],
};

const validPartnership = {
  name: "Иван Иванов",
  phone: "+7 (999) 123-45-67",
  city: "Москва",
  company: "Компания",
  offer: "Хотим поставлять продукцию в вашу розничную сеть.",
  consent: true,
  consentTelegram: true,
};

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

test("redelivers only missing chats and skips probes", async () => {
  // Резерв с частичной доставкой: чат 111 получил, 222 — нет.
  const reservation = await createReservation(reservationInput("Иван Петров"));
  await recordTelegramAttempt(reservation.id, ["111"]);

  // Заявка на партнёрство с частичной доставкой: только -123.
  const application = await createPartnership(validPartnership);
  await recordPartnershipAttempt(application.id, ["-123"]);

  // Проба монитор-бота: dispatch не запускался (attempts = 0) — свипер
  // не должен рассылать её даже при пустом deliveredTo (мандат 05.11).
  const probe = await createReservation(reservationInput("ТЕСТ Мониторинг"));

  const sentTo = [];
  const report = await redeliverIncompleteTelegram(
    channels,
    async (url, options) => {
      sentTo.push(JSON.parse(options.body).chat_id);
      return okResponse();
    },
  );

  // Только недоставленные чаты: -456 для партнёрства, 222 для резерва
  // (свипер проходит партнёрства, затем резервы).
  assert.deepEqual(sentTo, ["-456", "222"]);
  assert.equal(report.reservationDelivered, 1);
  assert.equal(report.partnershipDelivered, 1);

  const storedReservation = (await listReservations(10)).find(
    (item) => item.id === reservation.id,
  );
  assert.deepEqual(storedReservation.telegramDelivery.deliveredTo, [
    "111",
    "222",
  ]);
  const storedApplication = (await listPartnerships(10)).find(
    (item) => item.id === application.id,
  );
  assert.deepEqual(storedApplication.telegramDelivery.deliveredTo, [
    "-123",
    "-456",
  ]);
  // Проба не тронута: ни доставки, ни счётчика попыток.
  const storedProbe = (await listReservations(10)).find(
    (item) => item.id === probe.id,
  );
  assert.equal(storedProbe.telegramDelivery.attempts, 0);
  assert.deepEqual(storedProbe.telegramDelivery.deliveredTo, []);

  // Полное покрытие: повторный цикл ничего не отправляет.
  sentTo.length = 0;
  const again = await redeliverIncompleteTelegram(channels, async () =>
    okResponse(),
  );
  assert.deepEqual(sentTo, []);
  assert.equal(again.reservationDelivered, 0);
  assert.equal(again.partnershipDelivered, 0);
});

test("ignores entries older than the redelivery window", async () => {
  const reservation = await createReservation(
    reservationInput("Старый резерв"),
  );
  await recordTelegramAttempt(reservation.id, ["111"]);
  // Состариваем запись прямой правкой файла стора и сбрасываем кэш.
  const file = join(reservationDir, "reservations.json");
  const data = JSON.parse(readFileSync(file, "utf8"));
  const entry = data.requests.find((item) => item.id === reservation.id);
  entry.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  writeFileSync(file, JSON.stringify(data));
  resetReservationStoreForTests();

  const sentTo = [];
  await redeliverIncompleteTelegram(channels, async (url, options) => {
    sentTo.push(JSON.parse(options.body).chat_id);
    return okResponse();
  });
  // Свежих недоставленных нет, состаревшая отфильтрована окном 24 ч.
  assert.deepEqual(sentTo, []);
});

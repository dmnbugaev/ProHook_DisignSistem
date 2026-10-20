import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { createJiti } from "jiti";

/**
 * Жёсткий рубильник TELEGRAM_SILENT (мандат владельца 20.10.2026: в тестах
 * уведомления о заявках в боты не уходят). Проверяем худший случай — в
 * окружении «настоящие» токены и chat_id: диспетчеры обязаны завершиться
 * без единого сетевого вызова (fetch подменён счётчиком).
 */
process.env.TELEGRAM_SILENT = "1";
process.env.TELEGRAM_BOT_TOKEN = "silent-test-token";
process.env.TELEGRAM_RESERVATION_CHAT_IDS = "6939112736,1107248048";
process.env.TELEGRAM_PROMO_BOT_TOKEN = "silent-test-promo-token";
process.env.TELEGRAM_PROMO_CHAT_IDS = "6939112736";
process.env.RESERVATION_DATA_DIR = mkdtempSync(
  join(tmpdir(), "prohook-silence-res-"),
);
process.env.PROMO_DATA_DIR = mkdtempSync(
  join(tmpdir(), "prohook-silence-promo-"),
);
process.env.ACCOUNT_DATA_DIR = mkdtempSync(
  join(tmpdir(), "prohook-silence-acc-"),
);

const jiti = createJiti(import.meta.url);
const { dispatchReservationNotification } = await jiti.import(
  "../server/services/reservation-telegram.ts",
);
const { dispatchPartnershipNotification } = await jiti.import(
  "../server/services/partnership-telegram.ts",
);
const { sendPromoReply, fetchPromoUpdates } = await jiti.import(
  "../server/services/promo-telegram.ts",
);
const { telegramSilenced } = await jiti.import(
  "../server/utils/telegram-silence.ts",
);

const originalFetch = globalThis.fetch;
let networkCalls = 0;
globalThis.fetch = async () => {
  networkCalls++;
  throw new Error("сетевой вызов в заглушённом тесте недопустим");
};

after(() => {
  globalThis.fetch = originalFetch;
  for (const dir of [
    process.env.RESERVATION_DATA_DIR,
    process.env.PROMO_DATA_DIR,
    process.env.ACCOUNT_DATA_DIR,
  ])
    rmSync(dir, { recursive: true, force: true });
});

const reservation = {
  id: "silence-1",
  publicId: "R-TEST01",
  customerName: "Тест Тестов",
  phone: "79990000000",
  storeNameSnapshot: "Садовая 1",
  storeAddressSnapshot: "ул. Садовая, 1",
  comment: "",
  createdAt: new Date().toISOString(),
  items: [{ productNameSnapshot: "Тестовый товар", quantity: 1 }],
};

test("рубильник: диспетчер резерва молчит при реальных токенах", async () => {
  assert.equal(telegramSilenced(), true);
  // Завершается быстро, без ретраев и fallback-задач в МойСклад.
  await dispatchReservationNotification(reservation);
  assert.equal(networkCalls, 0);
});

test("рубильник: диспетчер партнёрства молчит при реальных токенах", async () => {
  await dispatchPartnershipNotification(
    { id: "silence-2", publicId: "P-TEST02" },
    { name: "Тест", phone: "+7 999 000-00-00", offer: "Текст" },
    "real-looking-token",
    ["6939112736"],
  );
  assert.equal(networkCalls, 0);
});

test("рубильник: бот акций не отправляет и не опрашивает Telegram", async () => {
  // sendPromoReply проглатывает ошибку «заглушено» — просто без сети.
  await sendPromoReply("6939112736", "ответ оператору");
  await assert.rejects(() => fetchPromoUpdates(0, 0));
  assert.equal(networkCalls, 0);
});

test("без флага рубильник неактивен", () => {
  const saved = process.env.TELEGRAM_SILENT;
  process.env.TELEGRAM_SILENT = "";
  try {
    assert.equal(telegramSilenced(), false);
  } finally {
    process.env.TELEGRAM_SILENT = saved;
  }
});

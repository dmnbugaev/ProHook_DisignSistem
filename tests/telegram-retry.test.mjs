import { test } from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { telegramRetryDelayMs, TELEGRAM_MAX_DELIVERY_ATTEMPTS } =
  await jiti.import("../server/services/telegram.ts");

// Регрессия 13.11.2026: база 60 с превращала секундный срыв соединения
// (флап туннеля myserver → Telegram волнами) в задержку доставки последнего
// чата до 30 минут. Лестница начинается с секунд и растёт до потолка.

test("расписание ретраев по умолчанию: быстрое начало, длинный хвост", () => {
  const saved = process.env.TELEGRAM_RETRY_DELAY_MS;
  delete process.env.TELEGRAM_RETRY_DELAY_MS;
  try {
    assert.equal(telegramRetryDelayMs(1), 3_000);
    assert.equal(telegramRetryDelayMs(2), 10_000);
    assert.equal(telegramRetryDelayMs(3), 30_000);
    assert.equal(telegramRetryDelayMs(4), 60_000);
    assert.equal(telegramRetryDelayMs(5), 120_000);
    assert.equal(telegramRetryDelayMs(6), 240_000);
    assert.equal(telegramRetryDelayMs(7), 300_000);
    // За пределами лестницы держится потолок — как раньше.
    assert.equal(telegramRetryDelayMs(8), 300_000);
    // Попыток диспетчера на одну больше, чем пауз: попытка без хвостовой паузы.
    assert.equal(TELEGRAM_MAX_DELIVERY_ATTEMPTS, 8);
  } finally {
    if (saved !== undefined) process.env.TELEGRAM_RETRY_DELAY_MS = saved;
  }
});

test("TELEGRAM_RETRY_DELAY_MS переопределяет лестницу (тесты/диагностика)", () => {
  const saved = process.env.TELEGRAM_RETRY_DELAY_MS;
  process.env.TELEGRAM_RETRY_DELAY_MS = "1";
  try {
    assert.equal(telegramRetryDelayMs(1), 1);
    assert.equal(telegramRetryDelayMs(3), 4);
    // Потолок действует и на переопределение.
    assert.equal(telegramRetryDelayMs(20), 300_000);
  } finally {
    if (saved !== undefined) process.env.TELEGRAM_RETRY_DELAY_MS = saved;
    else delete process.env.TELEGRAM_RETRY_DELAY_MS;
  }
});

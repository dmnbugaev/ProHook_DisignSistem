import {
  fetchPromoUpdates,
  handlePromoUpdateOnce,
} from "../services/promo-telegram";
import { telegramSilenced } from "../utils/telegram-silence";

/**
 * Поллинг-фолбэк бота промо-акций: getUpdates long poll. Включается только
 * явно — TELEGRAM_PROMO_POLLING=1 (dev/локальная машина, где исходящие к
 * api.telegram.org работают). На проде канал управления — вебхук
 * (хостер блокирует исходящие); в e2e-режиме (MOYSKLAD_SNAPSHOT_PATH) и без
 * токена поллинг не стартует — тесты молчат.
 */

const POLL_DELAY_MS = 3000;
const RETRY_DELAY_MS = 5000;

export default defineNitroPlugin(() => {
  if (process.env.TELEGRAM_PROMO_POLLING !== "1") return;
  if (!process.env.TELEGRAM_PROMO_BOT_TOKEN?.trim()) return;
  if (process.env.MOYSKLAD_SNAPSHOT_PATH) return;
  // Тестовое окружение: бот акций тоже молчит (мандат владельца 20.10).
  if (telegramSilenced()) return;

  const timer = setTimeout(() => {
    void (async () => {
      let offset = 0;
      for (;;) {
        try {
          const updates = await fetchPromoUpdates(offset);
          for (const update of updates) {
            offset = update.update_id + 1;
            await handlePromoUpdateOnce(update);
          }
        } catch (error) {
          // 409 — конфликт с активным вебхуком: поллинг не нужен, выходим.
          const message = error instanceof Error ? error.message : "";
          if (message.includes("409")) {
            console.error(
              "Promo bot polling stopped: webhook is active (409).",
            );
            return;
          }
          console.error(
            "Promo bot polling failed:",
            message || "Unknown error",
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    })();
  }, POLL_DELAY_MS);
  timer.unref?.();
});

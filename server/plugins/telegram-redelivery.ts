import {
  redeliverIncompleteTelegram,
  type RedeliveryChannels,
} from "../services/telegram-redelivery";
import { parseTelegramChatIds } from "../services/telegram";
import {
  parseReservationChatIds,
  reservationBotToken,
} from "../services/reservation-telegram";
import { telegramSilenced } from "../utils/telegram-silence";

/**
 * Периодическая до-доставка уведомлений о заявках: каждые 10 минут свипер
 * добирает недоставленные чаты по записям telegramDelivery в хранилищах.
 * Оправдание: egress myserver → api.telegram.org флапает с 30.10.2026,
 * и часть чатов allowlist может пропустить заявку даже после ретраев
 * диспетчера. В e2e-режиме (MOYSKLAD_SNAPSHOT_PATH) и при TELEGRAM_SILENT
 * цикл не стартует — тесты не отправляют ничего (мандат владельца 20.10).
 */

const REDELIVERY_INTERVAL_MS = 10 * 60 * 1000;

export default defineNitroPlugin(() => {
  if (process.env.MOYSKLAD_SNAPSHOT_PATH) return;
  if (telegramSilenced()) return;
  const config = useRuntimeConfig();
  const channels: RedeliveryChannels = {
    partnershipToken: String(config.telegramBotToken ?? "").trim(),
    partnershipChatIds: parseTelegramChatIds(config.telegramChatId),
    reservationToken: reservationBotToken(),
    reservationChatIds: parseReservationChatIds(
      process.env.TELEGRAM_RESERVATION_CHAT_IDS,
    ),
  };
  // Без конфигурации Telegram (dev) до-доставлять нечего.
  if (!channels.partnershipToken && !channels.reservationToken) return;
  const timer = setInterval(() => {
    void redeliverIncompleteTelegram(channels).catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown";
      console.error("Telegram redelivery cycle failed:", message);
    });
  }, REDELIVERY_INTERVAL_MS);
  // Ожидание цикла не должно удерживать процесс.
  timer.unref?.();
});

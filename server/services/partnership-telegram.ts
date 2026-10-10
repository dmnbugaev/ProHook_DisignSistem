import type { Partnership } from "../../shared/utils/partnership";
import {
  partnershipMessage,
  sendPartnership,
  TelegramUnreachableError,
} from "./telegram";
import {
  recordPartnershipAttempt,
  type StoredPartnership,
} from "./partnership-store";
import { notifyStaffViaMoySklad } from "./moysklad-notify";

/**
 * Доставка заявок на партнёрство в Telegram — best-effort с повторами,
 * по образцу reservation-telegram. Заявка уже сохранена в
 * partnership-store: сбой доставки (включая блокировку api.telegram.org
 * на уровне хостинга) не теряет её; сотрудники видят заявки в инбоксе
 * (/api/staff/inbox), повтор доставки привязан к id заявки.
 */

const MAX_DELIVERY_ATTEMPTS = 3;

function retryDelayMs(): number {
  const value = Number(process.env.TELEGRAM_RETRY_DELAY_MS);
  return Number.isFinite(value) && value >= 0 ? value : 60_000;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

// Защита от параллельных доставок одной заявки.
const inFlight = new Set<string>();

export async function dispatchPartnershipNotification(
  application: StoredPartnership,
  data: Partnership,
  botToken: string,
  chatIds: string[],
  request: typeof fetch = fetch,
): Promise<void> {
  if (!botToken || chatIds.length === 0) {
    await fallbackToMoySkladTask(application, data);
    return;
  }
  if (inFlight.has(application.id)) return;
  inFlight.add(application.id);
  try {
    for (let attempt = 1; attempt <= MAX_DELIVERY_ATTEMPTS; attempt++) {
      try {
        const deliveredTo = await sendPartnership(
          botToken,
          chatIds,
          data,
          application.publicId,
          request,
        );
        await recordPartnershipAttempt(application.id, deliveredTo);
        return;
      } catch (error) {
        await recordPartnershipAttempt(application.id, []);
        // Сетевая недоступность (хостинг блокирует api.telegram.org) —
        // ретраи не помогут, сразу уходим в резервный канал.
        if (error instanceof TelegramUnreachableError) break;
      }
      if (attempt < MAX_DELIVERY_ATTEMPTS) await delay(retryDelayMs());
    }
    await fallbackToMoySkladTask(application, data);
    // Без ПД и токена: только публичный номер заявки.
    console.error(
      "Partnership telegram delivery failed after retries:",
      application.publicId,
    );
  } finally {
    inFlight.delete(application.id);
  }
}

/**
 * Резервный канал: хостинг продакшена блокирует api.telegram.org, поэтому
 * недоставленное уведомление становится задачей в МойСклад (API доступен).
 */
async function fallbackToMoySkladTask(
  application: StoredPartnership,
  data: Partnership,
) {
  const created = await notifyStaffViaMoySklad(
    `Прохук · партнёрство ${application.publicId}`,
    partnershipMessage(data, application.publicId),
  );
  if (!created) return;
  console.info(
    "Partnership notification routed to MoySklad task:",
    application.publicId,
  );
}

import type { Partnership } from "../../shared/utils/partnership";
import { sendPartnership } from "./telegram";
import {
  recordPartnershipAttempt,
  type StoredPartnership,
} from "./partnership-store";

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
  if (!botToken || chatIds.length === 0) return;
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
      } catch {
        await recordPartnershipAttempt(application.id, []);
      }
      if (attempt < MAX_DELIVERY_ATTEMPTS) await delay(retryDelayMs());
    }
    // Без ПД и токена: только публичный номер заявки.
    console.error(
      "Partnership telegram delivery failed after retries:",
      application.publicId,
    );
  } finally {
    inFlight.delete(application.id);
  }
}

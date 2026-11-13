import type { Partnership } from "../../shared/utils/partnership";
import {
  logFatalChats,
  partnershipMessage,
  sendPartnership,
  telegramRetryDelayMs,
  TELEGRAM_MAX_DELIVERY_ATTEMPTS,
} from "./telegram";
import {
  recordPartnershipAttempt,
  type StoredPartnership,
} from "./partnership-store";
import { notifyStaffViaMoySklad } from "./moysklad-notify";
import { telegramSilenced } from "../utils/telegram-silence";

/**
 * Доставка заявок на партнёрство в Telegram — с повторами до полного
 * покрытия, по образцу reservation-telegram. Заявка уже сохранена в
 * partnership-store: сбой доставки (включая блокировку api.telegram.org
 * на уровне хостинга) не теряет её; сотрудники видят заявки в инбоксе
 * (/api/staff/inbox), повтор доставки привязан к id заявки.
 */

// Флап egress myserver → api.telegram.org (с 30.10.2026): каждый запрос
// доходит с шансом ~50–60%, поэтому «хотя бы один чат получил» — не успех.
// Успех = все чаты allowlist; ретраи добирают только недоставленные.
// Расписание пауз и лимит попыток — общие в ./telegram (быстрое начало,
// длинный хвост: волны флапа длятся от секунд до ~15 минут).

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
  // Тестовое окружение (TELEGRAM_SILENT): ни отправок, ни fallback-задач
  // в МойСклад — уведомления о заявках в тестах не уходят вовсе.
  if (telegramSilenced()) {
    console.info(
      "Partnership telegram dispatch silenced for tests:",
      application.publicId,
    );
    return;
  }
  if (!botToken || chatIds.length === 0) {
    await fallbackToMoySkladTask(application, data);
    return;
  }
  if (inFlight.has(application.id)) return;
  inFlight.add(application.id);
  try {
    // Повтор доставки привязан к id: чаты, уже получившие сообщение по
    // этой записи, не получают дубликат. Фатально отказавшие чаты (403 /
    // chat not found) из ретраев исключены — повтор в них бессмыслен.
    const delivered = new Set(application.telegramDelivery.deliveredTo);
    const fatal = new Set(application.telegramDelivery.fatalTo ?? []);
    for (
      let attempt = 1;
      attempt <= TELEGRAM_MAX_DELIVERY_ATTEMPTS;
      attempt++
    ) {
      const missing = chatIds.filter(
        (chatId) => !delivered.has(chatId) && !fatal.has(chatId),
      );
      if (missing.length === 0) break;
      // sendPartnership шлёт только в недоставленные чаты — успешные
      // не получают дубликат. Сетевые сбои при флапе туннеля лечатся
      // повтором, досрочного выхода нет.
      const report = await sendPartnership(
        botToken,
        missing,
        data,
        application.publicId,
        request,
      );
      logFatalChats(
        "Partnership telegram:",
        application.publicId,
        report.fatalTo,
        fatal,
      );
      await recordPartnershipAttempt(
        application.id,
        report.deliveredTo,
        report.fatalTo.map((entry) => entry.chatId),
      );
      for (const chatId of report.deliveredTo) delivered.add(chatId);
      if (delivered.size === chatIds.length) return;
      // Фатальные чаты не добираются повторами — не жжём ретраи впустую.
      if (delivered.size + fatal.size === chatIds.length) break;
      if (delivered.size > 0)
        console.warn(
          `Partnership telegram delivery partial: ${application.publicId} ${delivered.size}/${chatIds.length}, повтор ${attempt}`,
        );
      if (attempt < TELEGRAM_MAX_DELIVERY_ATTEMPTS)
        await delay(telegramRetryDelayMs(attempt));
    }
    if (delivered.size === 0) await fallbackToMoySkladTask(application, data);
    // Не добраны только фатальные чаты — причина уже в журнале выше.
    const pending = chatIds.filter(
      (chatId) => !delivered.has(chatId) && !fatal.has(chatId),
    );
    if (pending.length > 0)
      // Без ПД и токена: только публичный номер заявки.
      console.error(
        `Partnership telegram delivery incomplete after retries: ${application.publicId} ${delivered.size}/${chatIds.length}`,
      );
  } finally {
    inFlight.delete(application.id);
  }
}

/** Доставка ещё идёт? — свипер до-доставки пропускает такие записи. */
export function partnershipDeliveryInFlight(id: string): boolean {
  return inFlight.has(id);
}

/**
 * Резервный канал: хостинг продакшена блокирует api.telegram.org, поэтому
 * недоставленное уведомление становится задачей сотруднику в МойСклад.
 * Задача создаётся при полной недоставке (0 чатов); частичную добирает
 * свипер telegram-redelivery.
 */
async function fallbackToMoySkladTask(
  application: StoredPartnership,
  data: Partnership,
) {
  const created = await notifyStaffViaMoySklad(
    `ПроХук · партнёрство ${application.publicId}`,
    partnershipMessage(data, application.publicId),
  );
  if (!created) {
    // Раньше молчали: провал обоих каналов не должен быть невидимым.
    console.error(
      "Partnership MoySklad fallback failed:",
      application.publicId,
    );
    return;
  }
  console.info(
    "Partnership notification routed to MoySklad task:",
    application.publicId,
  );
}

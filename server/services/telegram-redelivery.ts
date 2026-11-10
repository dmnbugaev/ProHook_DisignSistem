import type { Partnership } from "../../shared/utils/partnership";
import {
  listPartnerships,
  recordPartnershipAttempt,
  type StoredPartnership,
} from "./partnership-store";
import {
  listReservations,
  recordTelegramAttempt,
  reservationDailyIndex,
} from "./reservation-store";
import { logFatalChats, sendPartnership } from "./telegram";
import {
  buildReservationMessage,
  deliverReservationMessage,
  reservationDeliveryInFlight,
} from "./reservation-telegram";
import { partnershipDeliveryInFlight } from "./partnership-telegram";

/**
 * Свипер до-доставки уведомлений о заявках.
 *
 * Флап egress myserver → api.telegram.org (с 30.10.2026) рвёт отдельные
 * отправки даже после ретраев диспетчера: заявка остаётся доставленной
 * лишь в часть чатов allowlist. Свипер периодически добирает
 * недоставленные чаты по записям telegramDelivery в хранилищах —
 * повтор привязан к id заявки, дубликатов успешным чатам не приходит.
 *
 * Пробы монитор-бота не рассылаются никогда (мандат владельца 05.11.2026):
 * у них dispatch не запускается, telegramDelivery.attempts остаётся 0 —
 * свипер обрабатывает только записи с attempts > 0.
 */

/** Окно до-доставки: резерв актуален сутки (RESERVATION_TTL_MS). */
export const REDELIVERY_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Потолок попыток: ~сутки циклов по 10 минут плюс ретраи диспетчера. */
export const REDELIVERY_MAX_ATTEMPTS = 160;

export interface RedeliveryChannels {
  partnershipToken: string;
  partnershipChatIds: string[];
  reservationToken: string;
  reservationChatIds: string[];
}

export interface RedeliveryReport {
  partnershipDelivered: number;
  reservationDelivered: number;
}

function dataFromStored(application: StoredPartnership): Partnership {
  return {
    name: application.name,
    phone: application.phone,
    city: application.city,
    company: application.company,
    offer: application.offer,
    consent: application.consent.personalData,
    consentTelegram: application.consent.telegram,
  };
}

function withinWindow(createdAt: string, now: number): boolean {
  const created = Date.parse(createdAt);
  return Number.isFinite(created) && now - created <= REDELIVERY_WINDOW_MS;
}

async function redeliverPartnerships(
  channels: RedeliveryChannels,
  request: typeof fetch,
  now: number,
): Promise<number> {
  if (!channels.partnershipToken || channels.partnershipChatIds.length === 0)
    return 0;
  let deliveredCount = 0;
  for (const application of await listPartnerships(100)) {
    const { attempts, deliveredTo, fatalTo } = application.telegramDelivery;
    const fatal = new Set(fatalTo ?? []);
    // attempts === 0 — рассылка намеренно пропущена (пробы монитор-бота).
    if (attempts === 0 || attempts >= REDELIVERY_MAX_ATTEMPTS) continue;
    if (partnershipDeliveryInFlight(application.id)) continue;
    if (!withinWindow(application.createdAt, now)) continue;
    const missing = channels.partnershipChatIds.filter(
      (chatId) => !deliveredTo.includes(chatId) && !fatal.has(chatId),
    );
    if (missing.length === 0) continue;
    const report = await sendPartnership(
      channels.partnershipToken,
      missing,
      dataFromStored(application),
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
    if (report.deliveredTo.length > 0) {
      deliveredCount += report.deliveredTo.length;
      console.info(
        `Partnership telegram redelivery: ${application.publicId} +${report.deliveredTo.length} чат(ов)`,
      );
    }
  }
  return deliveredCount;
}

async function redeliverReservations(
  channels: RedeliveryChannels,
  request: typeof fetch,
  now: number,
): Promise<number> {
  if (!channels.reservationToken || channels.reservationChatIds.length === 0)
    return 0;
  let deliveredCount = 0;
  for (const reservation of await listReservations(100)) {
    const { attempts, deliveredTo, fatalTo } = reservation.telegramDelivery;
    const fatal = new Set(fatalTo ?? []);
    // attempts === 0 — рассылка намеренно пропущена (пробы монитор-бота).
    if (attempts === 0 || attempts >= REDELIVERY_MAX_ATTEMPTS) continue;
    if (reservationDeliveryInFlight(reservation.id)) continue;
    if (!withinWindow(reservation.createdAt, now)) continue;
    const missing = channels.reservationChatIds.filter(
      (chatId) => !deliveredTo.includes(chatId) && !fatal.has(chatId),
    );
    if (missing.length === 0) continue;
    const report = await deliverReservationMessage(
      channels.reservationToken,
      missing,
      buildReservationMessage(
        reservation,
        await reservationDailyIndex(reservation),
      ),
      request,
    );
    logFatalChats(
      "Reservation telegram:",
      reservation.publicId,
      report.fatalTo,
      fatal,
    );
    await recordTelegramAttempt(
      reservation.id,
      report.deliveredTo,
      report.fatalTo.map((entry) => entry.chatId),
    );
    if (report.deliveredTo.length > 0) {
      deliveredCount += report.deliveredTo.length;
      console.info(
        `Reservation telegram redelivery: ${reservation.publicId} +${report.deliveredTo.length} чат(ов)`,
      );
    }
  }
  return deliveredCount;
}

let running = false;

/** Один цикл до-доставки: последовательно, без параллельных проходов. */
export async function redeliverIncompleteTelegram(
  channels: RedeliveryChannels,
  request: typeof fetch = fetch,
): Promise<RedeliveryReport> {
  if (running) return { partnershipDelivered: 0, reservationDelivered: 0 };
  running = true;
  try {
    const now = Date.now();
    return {
      partnershipDelivered: await redeliverPartnerships(channels, request, now),
      reservationDelivered: await redeliverReservations(channels, request, now),
    };
  } finally {
    running = false;
  }
}

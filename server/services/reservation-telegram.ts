import { formatPhone } from "../../shared/utils/account";
import {
  recordTelegramAttempt,
  type StoredReservation,
} from "./reservation-store";

/**
 * Telegram-уведомления о запросах на резерв (бот @prohook_bunker_site_bot).
 * Токен и список получателей существуют только в серверном окружении:
 * TELEGRAM_BOT_TOKEN и TELEGRAM_RESERVATION_CHAT_IDS (allowlist, через
 * запятую). Клиент не знает ни токен, ни chat_id и не может повлиять на
 * адресатов или текст: сообщение собирается на сервере из провалидированного
 * запроса и отправляется обычным текстом (без parse_mode — разметка
 * пользовательских строк невозможна по построению).
 *
 * Доставка — best-effort с повторами: сбой Telegram не теряет и не
 * дублирует запрос (запрос уже сохранён в reservation-store; повтор
 * доставки привязан к id запроса, а не создаёт новый запрос).
 */

const MAX_CHAT_IDS = 20;
const SEND_TIMEOUT_MS = 10000;
const MAX_DELIVERY_ATTEMPTS = 3;

export function parseReservationChatIds(raw: string | undefined): string[] {
  return [
    ...new Set(
      String(raw ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter((item) => /^\d{1,13}$/.test(item)),
    ),
  ].slice(0, MAX_CHAT_IDS);
}

export function reservationBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
}

/** Одна строка без управляющих символов — защита от подделки строк. */
function plain(value: string): string {
  const stripped = Array.from(value)
    .map((char) =>
      char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? " " : char,
    )
    .join("");
  return stripped.replace(/\s+/g, " ").trim();
}

function formatMoscow(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return plain(iso);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(date);
}

export function buildReservationMessage(
  reservation: StoredReservation,
): string {
  const items = reservation.items
    .map(
      (item, index) =>
        `${index + 1}. ${plain(item.productNameSnapshot)}\nКоличество: ${item.quantity} шт.`,
    )
    .join("\n\n");
  return [
    "🛍 Новый запрос на резерв",
    "",
    `Номер: ${reservation.publicId}`,
    "",
    "Магазин:",
    plain(reservation.storeNameSnapshot),
    ...(reservation.storeAddressSnapshot
      ? [plain(reservation.storeAddressSnapshot)]
      : []),
    "",
    "Клиент:",
    `Имя: ${plain(reservation.customerName)}`,
    `Телефон: ${plain(formatPhone(reservation.phone))}`,
    "",
    "Товары:",
    "",
    items || "—",
    "",
    "Комментарий:",
    reservation.comment ? plain(reservation.comment) : "—",
    "",
    `Создан: ${formatMoscow(reservation.createdAt)} (МСК)`,
    "",
    "Статус:",
    "Ожидает обработки",
    "",
    "Продажа, проверка возраста и оплата — только в магазине; онлайн-оплаты и доставки нет.",
  ].join("\n");
}

export async function deliverReservationMessage(
  token: string,
  chatIds: string[],
  text: string,
  request: typeof fetch = fetch,
): Promise<{ deliveredTo: string[] }> {
  const deliveredTo: string[] = [];
  const results = await Promise.allSettled(
    chatIds.map(async (chatId) => {
      const response = await request(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            link_preview_options: { is_disabled: true },
          }),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
      } | null;
      if (response.ok && result?.ok === true) return chatId;
      // Недоступность одного чата не блокирует остальные.
      throw new Error("telegram send failed");
    }),
  );
  for (const result of results)
    if (result.status === "fulfilled") deliveredTo.push(result.value);
  return { deliveredTo };
}

function retryDelayMs(): number {
  const value = Number(process.env.TELEGRAM_RETRY_DELAY_MS);
  return Number.isFinite(value) && value >= 0 ? value : 60_000;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    // Ожидание повтора не должно удерживать процесс.
    timer.unref?.();
  });
}

// Защита от параллельных доставок одного запроса (повтор POST по тому же
// Idempotency-Key доставку не дублирует — ответ переигрывается из кэша).
const inFlight = new Set<string>();

export async function dispatchReservationNotification(
  reservation: StoredReservation,
  request: typeof fetch = fetch,
): Promise<void> {
  const token = reservationBotToken();
  const chatIds = parseReservationChatIds(
    process.env.TELEGRAM_RESERVATION_CHAT_IDS,
  );
  // Без конфигурации бот молча пропускается (dev/тесты); запрос сохранён.
  if (!token || chatIds.length === 0) return;
  if (inFlight.has(reservation.id)) return;
  inFlight.add(reservation.id);
  try {
    const text = buildReservationMessage(reservation);
    for (let attempt = 1; attempt <= MAX_DELIVERY_ATTEMPTS; attempt++) {
      const { deliveredTo } = await deliverReservationMessage(
        token,
        chatIds,
        text,
        request,
      );
      await recordTelegramAttempt(reservation.id, deliveredTo);
      if (deliveredTo.length > 0) return;
      if (attempt < MAX_DELIVERY_ATTEMPTS) await delay(retryDelayMs());
    }
    // Без ПД и токена: только публичный номер запроса.
    console.error(
      "Reservation telegram delivery failed after retries:",
      reservation.publicId,
    );
  } finally {
    inFlight.delete(reservation.id);
  }
}

import { formatPhone } from "../../shared/utils/account";
import {
  recordTelegramAttempt,
  reservationDailyIndex,
  type StoredReservation,
} from "./reservation-store";
import { notifyStaffViaMoySklad } from "./moysklad-notify";
import { telegramSilenced } from "../utils/telegram-silence";
import {
  isFatalTelegramChatError,
  logFatalChats,
  telegramRetryDelayMs,
  TELEGRAM_MAX_DELIVERY_ATTEMPTS,
  type TelegramSendError,
} from "./telegram";

/**
 * Telegram-уведомления о запросах на резерв (бот @prohook_bunker_site_bot).
 * Токен и список получателей существуют только в серверном окружении:
 * TELEGRAM_BOT_TOKEN и TELEGRAM_RESERVATION_CHAT_IDS (allowlist, через
 * запятую). Клиент не знает ни токен, ни chat_id и не может повлиять на
 * адресатов или текст: сообщение собирается на сервере из провалидированного
 * запроса и отправляется обычным текстом (без parse_mode — разметка
 * пользовательских строк невозможна по построению).
 *
 * Доставка — с повторами до полного покрытия allowlist: успех = все чаты.
 * Ретраи добирают только недоставленные чаты, сбой Telegram не теряет и
 * не дублирует запрос (запрос уже сохранён в reservation-store; повтор
 * доставки привязан к id запроса, а не создаёт новый запрос).
 */

const MAX_CHAT_IDS = 20;
const SEND_TIMEOUT_MS = 10000;
// Флап egress myserver → api.telegram.org (с 30.10.2026): каждый запрос
// доходит с шансом ~50–60%, поэтому «хотя бы один чат получил» — не успех.
// Успех = все чаты allowlist; ретраи добирают только недоставленные.
// Расписание пауз и лимит попыток — общие в ./telegram (быстрое начало,
// длинный хвост: волны флапа длятся от секунд до ~15 минут).

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

function formatInTimeZone(
  iso: string,
  timeZone: string,
  withDate: boolean,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return plain(iso);
  return new Intl.DateTimeFormat("ru-RU", {
    day: withDate ? "2-digit" : undefined,
    month: withDate ? "2-digit" : undefined,
    year: withDate ? "numeric" : undefined,
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

function formatMoscow(iso: string): string {
  return formatInTimeZone(iso, "Europe/Moscow", true);
}

/**
 * Строка нумерации за день: день и номер — по времени Саратова
 * (штаб-квартира сети, МСК+1), время дублируется обоими поясами —
 * магазины работают в Саратове и Москве.
 */
function dailyIndexLine(
  reservation: StoredReservation,
  dailyIndex: number,
): string {
  return `Заявка №${dailyIndex} за день · Саратов ${formatInTimeZone(reservation.createdAt, "Europe/Saratov", true)} (МСК ${formatInTimeZone(reservation.createdAt, "Europe/Moscow", false)})`;
}

export function buildReservationMessage(
  reservation: StoredReservation,
  dailyIndex: number | null = null,
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
    ...(dailyIndex && dailyIndex > 0
      ? ["", dailyIndexLine(reservation, dailyIndex)]
      : []),
  ].join("\n");
}

export async function deliverReservationMessage(
  token: string,
  chatIds: string[],
  text: string,
  request: typeof fetch = fetch,
): Promise<{
  deliveredTo: string[];
  /** Чаты с фатальным отказом (403 / chat not found) — ретраи отключены. */
  fatalTo: Array<{ chatId: string; description: string }>;
}> {
  const deliveredTo: string[] = [];
  const fatalTo: Array<{ chatId: string; description: string }> = [];
  const results = await Promise.allSettled(
    chatIds.map(async (chatId) => {
      let response: Response;
      try {
        response = await request(
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
      } catch {
        // Сетевой уровень (DNS/TCP/сброс туннеля). При флапе egress это
        // проходящая ошибка — её доберут ретраи диспетчера и свипера.
        return null;
      }
      const result = (await response.json().catch(() => null)) as
        (TelegramSendError & { result?: unknown }) | null;
      if (response.ok && result?.ok === true)
        return { chatId, delivered: true, fatal: false, description: "" };
      const fatal = isFatalTelegramChatError(
        result?.error_code,
        result?.description,
      );
      return {
        chatId,
        delivered: false,
        fatal,
        description: result?.description ?? `HTTP ${response.status}`,
      };
    }),
  );
  for (const result of results) {
    if (result.status !== "fulfilled" || result.value === null) continue;
    const { chatId, delivered, fatal, description } = result.value;
    if (delivered) deliveredTo.push(chatId);
    else if (fatal) fatalTo.push({ chatId, description });
  }
  return { deliveredTo, fatalTo };
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
  // Тестовое окружение (TELEGRAM_SILENT): ни отправок, ни fallback-задач
  // в МойСклад — уведомления о заявках в тестах не уходят вовсе.
  if (telegramSilenced()) {
    console.info(
      "Reservation telegram dispatch silenced for tests:",
      reservation.publicId,
    );
    return;
  }
  const token = reservationBotToken();
  const chatIds = parseReservationChatIds(
    process.env.TELEGRAM_RESERVATION_CHAT_IDS,
  );
  // Без конфигурации бот молча пропускается (dev/тесты); запрос сохранён.
  if (!token || chatIds.length === 0) {
    await fallbackToMoySkladTask(
      reservation,
      await reservationDailyIndex(reservation),
    );
    return;
  }
  if (inFlight.has(reservation.id)) return;
  inFlight.add(reservation.id);
  try {
    const dailyIndex = await reservationDailyIndex(reservation);
    const text = buildReservationMessage(reservation, dailyIndex);
    // Повтор доставки привязан к id: чаты, уже получившие сообщение по
    // этой записи, не получают дубликат. Фатально отказавшие чаты (403 /
    // chat not found) из ретраев исключены — повтор в них бессмыслен.
    const delivered = new Set(reservation.telegramDelivery.deliveredTo);
    const fatal = new Set(reservation.telegramDelivery.fatalTo ?? []);
    for (
      let attempt = 1;
      attempt <= TELEGRAM_MAX_DELIVERY_ATTEMPTS;
      attempt++
    ) {
      const missing = chatIds.filter(
        (chatId) => !delivered.has(chatId) && !fatal.has(chatId),
      );
      if (missing.length === 0) break;
      // deliverReservationMessage шлёт только в недоставленные чаты —
      // успешные не получают дубликат.
      const report = await deliverReservationMessage(
        token,
        missing,
        text,
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
      for (const chatId of report.deliveredTo) delivered.add(chatId);
      if (delivered.size === chatIds.length) return;
      // Фатальные чаты не добираются повторами — не жжём ретраи впустую.
      if (delivered.size + fatal.size === chatIds.length) break;
      // Сетевые сбои при флапе туннеля лечатся повтором — не выходим.
      if (delivered.size > 0)
        console.warn(
          `Reservation telegram delivery partial: ${reservation.publicId} ${delivered.size}/${chatIds.length}, повтор ${attempt}`,
        );
      if (attempt < TELEGRAM_MAX_DELIVERY_ATTEMPTS)
        await delay(telegramRetryDelayMs(attempt));
    }
    if (delivered.size === 0)
      await fallbackToMoySkladTask(reservation, dailyIndex);
    // Не добраны только фатальные чаты — причина уже в журнале выше.
    const pending = chatIds.filter(
      (chatId) => !delivered.has(chatId) && !fatal.has(chatId),
    );
    if (pending.length > 0)
      // Без ПД и токена: только публичный номер запроса.
      console.error(
        `Reservation telegram delivery incomplete after retries: ${reservation.publicId} ${delivered.size}/${chatIds.length}`,
      );
  } finally {
    inFlight.delete(reservation.id);
  }
}

/** Доставка ещё идёт? — свипер до-доставки пропускает такие записи. */
export function reservationDeliveryInFlight(id: string): boolean {
  return inFlight.has(id);
}

/**
 * Резервный канал: хостинг продакшена блокирует api.telegram.org, поэтому
 * недоставленное уведомление становится задачей в МойСклад (API доступен).
 * Задача создаётся при полной недоставке (0 чатов); частичную добирает
 * свипер telegram-redelivery. Без токена МойСклад (dev/e2e) — логируется.
 */
async function fallbackToMoySkladTask(
  reservation: StoredReservation,
  dailyIndex: number,
) {
  const created = await notifyStaffViaMoySklad(
    `ПроХук · резерв ${reservation.publicId}`,
    buildReservationMessage(reservation, dailyIndex),
  );
  if (!created) {
    // Раньше молчали: провал обоих каналов не должен быть невидимым.
    console.error(
      "Reservation MoySklad fallback failed:",
      reservation.publicId,
    );
    return;
  }
  console.info(
    "Reservation notification routed to MoySklad task:",
    reservation.publicId,
  );
}

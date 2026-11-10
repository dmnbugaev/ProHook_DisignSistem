import { type Partnership } from "../../shared/utils/partnership";

export function partnershipMessage(data: Partnership, id: string) {
  return [
    "Новая заявка на партнёрство · ПроХук",
    `Заявка: ${id}`,
    "",
    `ФИО: ${data.name}`,
    `Телефон: ${data.phone}`,
    `Город / регион: ${data.city}`,
    `Компания: ${data.company}`,
    `Предложение: ${data.offer}`,
    "Согласие на обработку персональных данных: получено",
    "Согласие на передачу через Telegram: получено",
  ].join("\n");
}

// Nuxt coerces numeric env values (e.g. NUXT_TELEGRAM_CHAT_ID=6939112736) to numbers.
export function parseTelegramChatIds(raw: string | number) {
  return String(raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Тело ответа Telegram Bot API на отправку (успех или ошибка). */
export interface TelegramSendError {
  ok?: boolean;
  error_code?: number;
  description?: string;
}

/**
 * Фатальный для чата отказ Telegram: повтор в этот же чат бессмыслен.
 * 403 — бот заблокирован получателем / не может начать диалог / аккаунт
 * удалён; 400 «chat not found» — получатель не начинал диалог с ботом
 * (диагностика 10.11.2026: чат allowlist резерва отвечал так на каждую
 * отправку, 160 ретраев свипера впустую). Остальные отказы (429, 5xx,
 * обрывы) проходящие — флап туннеля лечится повтором.
 */
export function isFatalTelegramChatError(
  errorCode: number | undefined,
  description: string | undefined,
): boolean {
  if (errorCode === 403) return true;
  return errorCode === 400 && /chat not found/i.test(description ?? "");
}

/** Маска chat_id для журнала: полный идентификатор не публикуем. */
export function maskChatId(chatId: string): string {
  return `*${chatId.slice(-4)}`;
}

/** Результат рассылки по чатам: доставленные и фатально отказавшие. */
export interface TelegramSendReport {
  deliveredTo: string[];
  fatalTo: Array<{ chatId: string; description: string }>;
}

/**
 * Журнал для чатов, впервые получивших фатальный отказ: причина видна
 * владельцу сразу, а не после жалобы «заявки не приходят».
 */
export function logFatalChats(
  scope: string,
  publicId: string,
  fatalTo: Array<{ chatId: string; description: string }>,
  alreadyFatal: Set<string>,
): void {
  for (const { chatId, description } of fatalTo) {
    if (alreadyFatal.has(chatId)) continue;
    alreadyFatal.add(chatId);
    console.error(
      `${scope} ${publicId}: Telegram отклонил чат ${maskChatId(chatId)} — ${description}. Получатель не начинал диалог с ботом, заблокировал его или id ошибочен; ретраи в этот чат отключены, заявка доступна в инбоксе.`,
    );
  }
}

export async function sendPartnership(
  token: string,
  chatIds: string[],
  data: Partnership,
  id: string,
  request: typeof fetch = fetch,
): Promise<TelegramSendReport> {
  // Plain text deliberately avoids interpreting user input as Telegram markup.
  const deliveredTo: string[] = [];
  const fatalTo: Array<{ chatId: string; description: string }> = [];
  for (const chatId of chatIds) {
    try {
      const response = await request(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: partnershipMessage(data, id),
            link_preview_options: { is_disabled: true },
          }),
          signal: AbortSignal.timeout(10000),
        },
      );
      const result = (await response.json().catch(() => null)) as
        (TelegramSendError & { result?: { message_id?: number } }) | null;
      if (
        response.ok &&
        result?.ok === true &&
        typeof result.result?.message_id === "number"
      ) {
        deliveredTo.push(chatId);
        continue;
      }
      if (isFatalTelegramChatError(result?.error_code, result?.description))
        fatalTo.push({
          chatId,
          description: result?.description ?? `HTTP ${response.status}`,
        });
    } catch {
      // Сетевой сбой (флап туннеля) проходящий — его доберут ретраи.
    }
  }
  return { deliveredTo, fatalTo };
}

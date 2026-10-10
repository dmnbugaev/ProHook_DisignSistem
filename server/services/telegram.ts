import { type Partnership } from "../../shared/utils/partnership";

export function partnershipMessage(data: Partnership, id: string) {
  return [
    "Новая заявка на партнёрство · Прохук",
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

export async function sendPartnership(
  token: string,
  chatIds: string[],
  data: Partnership,
  id: string,
  request: typeof fetch = fetch,
): Promise<string[]> {
  // Plain text deliberately avoids interpreting user input as Telegram markup.
  const deliveredTo: string[] = [];
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
      const result = (await response.json()) as {
        ok?: boolean;
        result?: { message_id?: number };
      };
      if (
        response.ok &&
        result.ok === true &&
        typeof result.result?.message_id === "number"
      ) {
        deliveredTo.push(chatId);
      }
    } catch {
      // One unreachable chat must not block delivery to the others.
    }
  }
  if (deliveredTo.length === 0) throw new Error("Telegram delivery failed");
  return deliveredTo;
}

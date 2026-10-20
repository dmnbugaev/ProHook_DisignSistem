import { handlePromoUpdateOnce } from "../../../services/promo-telegram";

/**
 * Вебхук бота промо-акций: Telegram присылает апдейты сюда (входящие
 * соединения не блокируются хостером, в отличие от исходящих). Секрет
 * проверяется заголовком X-Telegram-Bot-Api-Secret-Token; апдейты из
 * чужих чатов игнорируются внутри обработчика. Всегда 200 — иначе Telegram
 * повторяет доставку.
 */
export default defineEventHandler(async (event) => {
  const secret = process.env.TELEGRAM_PROMO_WEBHOOK_SECRET?.trim();
  const header = getHeader(event, "x-telegram-bot-api-secret-token");
  if (!secret || !header || header !== secret)
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  const update = await readBody(event);
  if (typeof update !== "object" || update === null) return { ok: true };
  await handlePromoUpdateOnce(update);
  return { ok: true };
});

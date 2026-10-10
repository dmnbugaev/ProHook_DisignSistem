import { validatePartnership } from "../../shared/utils/partnership";
import { parseTelegramChatIds } from "../services/telegram";
import { createPartnership } from "../services/partnership-store";
import { dispatchPartnershipNotification } from "../services/partnership-telegram";
import { allowPartnership } from "../utils/partnership-rate-limit";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "no-store");
  if (getHeader(event, "sec-fetch-site") === "cross-site") {
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  }
  if (
    getHeader(event, "content-type")?.split(";")[0]?.trim() !==
    "application/json"
  ) {
    throw createError({ statusCode: 415, statusMessage: "JSON required" });
  }
  if (!allowPartnership(getRequestIP(event) ?? "unknown")) {
    setResponseHeader(event, "Retry-After", 900);
    throw createError({ statusCode: 429, statusMessage: "Too many requests" });
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of event.node.req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 8192) {
      throw createError({
        statusCode: 413,
        statusMessage: "Payload too large",
      });
    }
    chunks.push(buffer);
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Invalid JSON" });
  }
  if (body && typeof body === "object" && "website" in body && body.website) {
    throw createError({ statusCode: 400, statusMessage: "Invalid submission" });
  }
  const { data, errors, valid } = validatePartnership(body);
  if (!valid)
    throw createError({
      statusCode: 422,
      statusMessage: "Invalid fields",
      data: { errors },
    });
  const config = useRuntimeConfig(event);
  // Заявка сохраняется до любой доставки: сбой Telegram (в том числе
  // блокировка api.telegram.org хостингом) не теряет её и не возвращает
  // ошибку отправителю. Сотрудники читают заявки в инбоксе /api/staff/inbox.
  const application = await createPartnership(data);
  const chatIds = parseTelegramChatIds(config.telegramChatId);
  void dispatchPartnershipNotification(
    application,
    data,
    config.telegramBotToken,
    chatIds,
  ).catch(() => {
    // Без ПД и токена: только публичный номер заявки.
    console.error(
      "Partnership notification dispatch failed:",
      application.publicId,
    );
  });
  return { ok: true, id: application.publicId };
});

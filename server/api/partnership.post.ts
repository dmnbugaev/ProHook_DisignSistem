import { randomUUID } from "node:crypto";
import { validatePartnership } from "../../shared/utils/partnership";
import { sendPartnership, parseTelegramChatIds } from "../services/telegram";
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
  const chatIds = parseTelegramChatIds(config.telegramChatId);
  if (!config.telegramBotToken || chatIds.length === 0) {
    throw createError({
      statusCode: 503,
      statusMessage: "Partnership delivery unavailable",
    });
  }
  const id = randomUUID();
  try {
    await sendPartnership(config.telegramBotToken, chatIds, data, id);
  } catch {
    // Never log upstream errors: they may contain the bot token or applicant data.
    throw createError({
      statusCode: 502,
      statusMessage: "Partnership delivery failed",
    });
  }
  return { ok: true, id };
});

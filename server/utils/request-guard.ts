import type { H3Event } from "h3";

/**
 * Общие защиты JSON-эндпоинтов (по образцу partnership.post.ts):
 * запрет cross-site запросов, требование JSON и лимит размера тела.
 */
export async function guardJsonRequest(
  event: H3Event,
  maxBytes: number,
): Promise<unknown> {
  setResponseHeader(event, "Cache-Control", "no-store");
  if (getHeader(event, "sec-fetch-site") === "cross-site")
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  if (
    getHeader(event, "content-type")?.split(";")[0]?.trim() !==
    "application/json"
  )
    throw createError({ statusCode: 415, statusMessage: "JSON required" });
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of event.node.req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes)
      throw createError({
        statusCode: 413,
        statusMessage: "Payload too large",
      });
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Invalid JSON" });
  }
}

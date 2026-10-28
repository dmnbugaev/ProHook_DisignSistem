import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PROMO_MEDIA_DIR, listPromos } from "../../../services/promo-store";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  // видео-стикеры Telegram
  webm: "video/webm",
};

const MEDIA_FILE_RE = /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|webm)$/;

/**
 * Медиа промо-карточки: фото или стикер (?variant=poster — статичный эскиз
 * видео-стикера). Сам блок акций показывается после подтверждения 18+,
 * поэтому и прямой доступ к файлу гейтится cookie — анонимный запрос
 * получает 403 (содержимое карточек готовит владелец, но оно может включать
 * регулируемый ассортимент).
 */
export default defineEventHandler(async (event) => {
  if (!hasAgeConfirmation(event))
    throw createError({ statusCode: 403, statusMessage: "Adults only" });
  const id = getRouterParam(event, "id") || "";
  const promo = (await listPromos()).find((item) => item.id === id);
  // mediaFile генерируется сервисом (uuid.ext) — валидируем на всякий случай.
  const fileName =
    getQuery(event).variant === "poster"
      ? promo?.mediaPosterFile
      : promo?.mediaFile;
  if (!fileName || !MEDIA_FILE_RE.test(fileName))
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  try {
    const bytes = await readFile(resolve(PROMO_MEDIA_DIR, fileName));
    setHeader(
      event,
      "Content-Type",
      CONTENT_TYPES[fileName.split(".").at(-1)!] ?? "image/jpeg",
    );
    setHeader(event, "Cache-Control", "private, max-age=300");
    return bytes;
  } catch {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }
});

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import {
  createPromo,
  deletePromo,
  listPromos,
  pinPromo,
  setPromoStatus,
  MAX_TEXT,
  MAX_TITLE,
  PROMO_MEDIA_DIR,
} from "./promo-store";
import {
  cleanTelegramText,
  sliceWithEntities,
  telegramTextToHtml,
  truncateForPromo,
  trimWithEntities,
  type TelegramMessageEntity,
} from "./promo-format";
import { telegramSilenced } from "../utils/telegram-silence";

/**
 * Бот промо-акций (@…, токен в TELEGRAM_PROMO_BOT_TOKEN): наполняет блок
 * «Акции и предложения» на главной. Управление — сообщениями из allowlist
 * TELEGRAM_PROMO_CHAT_IDS: обычное сообщение (или фото с подписью) создаёт
 * карточку, команды /list /on N /off N /del N /pin N /help управляют ею.
 * Форматирование сообщения (entities: жирный, курсив, цитаты, ссылки) и
 * переносы строк сохраняются — карточка на сайте выглядит как в Telegram;
 * стикер становится карточкой со стикером.
 *
 * Каналы приёма команд: getUpdates-поллинг TELEGRAM_PROMO_POLLING=1 (прод —
 * через SSH-туннель к api.telegram.org с myserver; вебхук не работает:
 * входящие от подсетей Telegram к REG.RU дропаются на магистрали, поэтому
 * прод сам забирает апдейты) и вебхук POST /api/telegram/promo/webhook
 * (запасной канал для хостинга без такой блокировки). Ответы бота —
 * best-effort: недоступность Telegram не влияет на карточки на сайте.
 */

const MAX_CHAT_IDS = 20;
const API_TIMEOUT_MS = 10000;

/** Минимальная форма Telegram-апдейта, с которой работает бот. */
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
    caption?: string;
    entities?: TelegramMessageEntity[];
    caption_entities?: TelegramMessageEntity[];
    photo?: Array<{ file_id: string; file_size?: number }>;
    sticker?: TelegramSticker;
  };
}

interface TelegramSticker {
  file_id: string;
  /** Статический эскиз (для видео-стикеров — постер <video> на сайте). */
  thumbnail?: { file_id: string };
  is_animated?: boolean;
  is_video?: boolean;
}

export function promoBotToken(): string {
  return process.env.TELEGRAM_PROMO_BOT_TOKEN?.trim() ?? "";
}

export function parsePromoChatIds(raw: string | undefined): string[] {
  return [
    ...new Set(
      String(raw ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter((item) => /^-?\d{1,13}$/.test(item)),
    ),
  ].slice(0, MAX_CHAT_IDS);
}

function promoChatIds(): string[] {
  return parsePromoChatIds(process.env.TELEGRAM_PROMO_CHAT_IDS);
}

async function telegramApi(
  method: string,
  params: Record<string, string | number>,
  timeoutMs: number = API_TIMEOUT_MS,
): Promise<unknown> {
  const token = promoBotToken();
  if (!token) throw new Error("Promo bot token is not configured");
  if (telegramSilenced()) throw new Error("Telegram silenced for tests");
  const url = new URL(`https://api.telegram.org/bot${token}/${method}`);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    // long-poll (getUpdates) висит дольше обычного запроса — его таймаут
    // передаётся отдельно, иначе каждые 10 с журнал продa заполняется
    // ложными «polling failed: aborted due to timeout».
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok)
    throw new Error(`Telegram ${method} failed: HTTP ${response.status}`);
  return response.json();
}

/** Отправка ответа оператору; сбой (блок хостинга) только логируется. */
export async function sendPromoReply(
  chatId: string,
  text: string,
): Promise<void> {
  if (!promoBotToken()) return;
  try {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: text.slice(0, 4000),
      link_preview_options: '{"is_disabled":true}',
    });
  } catch (error) {
    console.error(
      "Promo bot reply failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export type PromoBotCommand =
  | {
      kind: "create";
      title: string;
      titleHtml: string;
      text: string;
      textHtml: string;
      ctaLabel: string | null;
      ctaHref: string | null;
    }
  | { kind: "list" }
  | { kind: "help" }
  | { kind: "status"; status: "active" | "hidden"; number: number }
  | { kind: "delete"; number: number }
  | { kind: "pin"; number: number }
  | { kind: "ignore" };

/**
 * Разбор сообщения оператора: команда или текст будущей карточки.
 * Форматирование из entities сохраняется: заголовок и текст получают
 * готовый безопасный HTML, переносы строк и отступы не сворачиваются.
 */
export function parsePromoBotCommand(
  raw: string,
  entities: TelegramMessageEntity[] = [],
): PromoBotCommand {
  const clean = trimWithEntities(cleanTelegramText(raw, entities));
  const text = clean.text;
  if (!text) return { kind: "ignore" };
  const [firstLine] = text.split("\n");
  const command = (firstLine ?? "").trim().split(/\s+/);
  const name = command[0]?.toLocaleLowerCase("ru") ?? "";
  if (name === "/start" || name === "/help") return { kind: "help" };
  if (name === "/list") return { kind: "list" };
  if (name === "/del" || name === "/delete")
    return parseNumberCommand(command, "delete");
  if (name === "/pin") return parseNumberCommand(command, "pin");
  if (name === "/on" || name === "/show")
    return parseNumberCommand(command, "status", "active");
  if (name === "/off" || name === "/hide")
    return parseNumberCommand(command, "status", "hidden");
  if (name.startsWith("/")) return { kind: "ignore" };

  // Обычное сообщение — новая карточка: первая строка — заголовок, остаток —
  // текст; последняя строка-ссылка (/path, https://… или строка целиком под
  // text_link) становится кнопкой. Пустые строки внутри текста и отступы
  // строк сохраняются «как в Телеграме».
  const lines = text.split("\n");
  const lineAt = (index: number) => lines[index] ?? "";
  const lineStarts: number[] = [];
  let cursor = 0;
  for (const line of lines) {
    lineStarts.push(cursor);
    cursor += line.length + 1;
  }

  const title = truncateForPromo(
    trimWithEntities(
      sliceWithEntities(text, clean.entities, 0, lineAt(0).length),
    ),
    MAX_TITLE,
  );

  let last = lines.length - 1;
  while (last >= 1 && !lineAt(last).trim()) last--;
  let ctaHref: string | null = null;
  let ctaLabel: string | null = null;
  if (last >= 1) {
    const line = lineAt(last);
    const trimmed = line.trim();
    const start =
      (lineStarts[last] ?? 0) + (line.length - line.trimStart().length);
    const end = start + trimmed.length;
    const link = clean.entities.find(
      (entity) =>
        entity.type === "text_link" &&
        entity.offset <= start &&
        entity.offset + entity.length >= end,
    );
    if (
      /^https:\/\/\S+$/i.test(trimmed) ||
      /^\/[a-z0-9\-./?#%=&]*$/i.test(trimmed)
    ) {
      ctaHref = trimmed;
      last--;
    } else if (link?.url) {
      ctaHref = link.url;
      ctaLabel = trimmed;
      last--;
    }
  }

  let bodyEnd = last;
  while (bodyEnd >= 1 && !lineAt(bodyEnd).trim()) bodyEnd--;
  const body =
    bodyEnd >= 1
      ? truncateForPromo(
          sliceWithEntities(
            text,
            clean.entities,
            lineStarts[1] ?? 0,
            (lineStarts[bodyEnd] ?? 0) + lineAt(bodyEnd).length,
          ),
          MAX_TEXT,
        )
      : { text: "", entities: [] };

  return {
    kind: "create",
    title: title.text,
    titleHtml: telegramTextToHtml(title.text, title.entities),
    text: body.text,
    textHtml: telegramTextToHtml(body.text, body.entities),
    ctaLabel,
    ctaHref,
  };
}

function parseNumberCommand(
  parts: string[],
  kind: "delete" | "pin",
): PromoBotCommand;
function parseNumberCommand(
  parts: string[],
  kind: "status",
  status: "active" | "hidden",
): PromoBotCommand;
function parseNumberCommand(
  parts: string[],
  kind: "delete" | "pin" | "status",
  status?: "active" | "hidden",
): PromoBotCommand {
  const number = Number.parseInt(parts[1] ?? "", 10);
  if (!Number.isInteger(number) || number <= 0) return { kind: "ignore" };
  if (kind === "status") return { kind, status: status!, number };
  return { kind, number };
}

const HELP_TEXT = [
  "Бот акций ПроХук — карточки блока «Акции и предложения» на главной.",
  "",
  "Просто пришлите сообщение — станет новой карточкой:",
  "1-я строка — заголовок, остальное — текст.",
  "Последняя строка /catalog или https://… — кнопка-ссылка.",
  "Фото с подписью — карточка с изображением.",
  "Форматирование сохраняется: жирный, курсив, цитаты, переносы строк.",
  "Стикер — карточка со стикером (анимированные tgs не поддерживаются).",
  "",
  "Команды:",
  "/list — список карточек",
  "/off N — скрыть, /on N — вернуть",
  "/del N — удалить",
  "/pin N — закрепить в начале",
].join("\n");

/** Скачивание медиа карточки (фото или стикер) во внутренний каталог хранилища. */
async function downloadPromoMedia(fileId: string): Promise<string | null> {
  const token = promoBotToken();
  if (!token) return null;
  const info = (await telegramApi("getFile", { file_id: fileId })) as {
    result?: { file_path?: string };
  };
  const filePath = info.result?.file_path;
  if (!filePath) return null;
  const extension = filePath.split(".").at(-1)?.toLocaleLowerCase("ru");
  if (!["jpg", "jpeg", "png", "webp", "webm"].includes(extension ?? ""))
    return null;
  const response = await fetch(
    `https://api.telegram.org/file/bot${token}/${filePath}`,
    { signal: AbortSignal.timeout(API_TIMEOUT_MS) },
  );
  if (!response.ok) return null;
  const name = `${randomUUID()}.${extension}`;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > 5 * 1024 * 1024) return null;
  await mkdir(PROMO_MEDIA_DIR, { recursive: true, mode: 0o700 });
  await writeFile(`${PROMO_MEDIA_DIR}/${name}`, bytes, { mode: 0o600 });
  return name;
}

/**
 * Стикер — карточка со стикером без текста (у стикеров в Telegram не бывает
 * подписи). Поддержаны статические (webp) и видео-стикеры (webm, статичный
 * thumbnail становится постером видео); анимированные tgs (Lottie) на сайте
 * не отобразить — вежливо отказываем.
 */
async function handleStickerMessage(
  chatId: string,
  sticker: TelegramSticker,
): Promise<void> {
  if (sticker.is_animated && !sticker.is_video) {
    await sendPromoReply(
      chatId,
      "Анимированные (tgs) стикеры не поддерживаются — пришлите обычный или видеостикер.",
    );
    return;
  }
  const mediaFile = await downloadPromoMedia(sticker.file_id);
  if (!mediaFile) {
    await sendPromoReply(
      chatId,
      "Не удалось скачать стикер. Попробуйте ещё раз.",
    );
    return;
  }
  const poster = sticker.thumbnail
    ? ((await downloadPromoMedia(sticker.thumbnail.file_id)) ?? null)
    : null;
  const promo = await createPromo({
    title: "",
    text: "",
    mediaFile,
    mediaPosterFile: poster,
    mediaKind: "sticker",
  });
  await sendPromoReply(
    chatId,
    `Карточка №${promo.number} добавлена (стикер) и уже на сайте.`,
  );
}

/** Обработка одного апдейта: allowlist → команда → ответ оператору. */
export async function handlePromoUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message) return;
  const chatId = String(message.chat.id);
  if (!promoChatIds().includes(chatId)) return;
  const raw = message.text ?? message.caption ?? "";
  const entities = message.entities ?? message.caption_entities ?? [];
  const command = parsePromoBotCommand(raw, entities);
  try {
    if (message.sticker) {
      await handleStickerMessage(chatId, message.sticker);
      return;
    }
    switch (command.kind) {
      case "help":
        await sendPromoReply(chatId, HELP_TEXT);
        return;
      case "list": {
        const promos = await listPromos();
        if (!promos.length) {
          await sendPromoReply(chatId, "Карточек пока нет.");
          return;
        }
        await sendPromoReply(
          chatId,
          promos
            .map(
              (promo) =>
                `${promo.status === "active" ? "●" : "○"} №${promo.number} — ${promo.title || "(стикер)"}`,
            )
            .join("\n"),
        );
        return;
      }
      case "create": {
        const photo = message.photo?.at(-1);
        const mediaFile = photo
          ? ((await downloadPromoMedia(photo.file_id)) ?? null)
          : null;
        const promo = await createPromo({ ...command, mediaFile });
        await sendPromoReply(
          chatId,
          photo && !mediaFile
            ? `Карточка №${promo.number} добавлена без фото (не удалось скачать).`
            : `Карточка №${promo.number} добавлена и уже на сайте.`,
        );
        return;
      }
      case "status": {
        const promo = await setPromoStatus(command.number, command.status);
        await sendPromoReply(
          chatId,
          promo
            ? `Карточка №${promo.number} ${command.status === "active" ? "включена" : "скрыта"}.`
            : `Карточка №${command.number} не найдена.`,
        );
        return;
      }
      case "delete": {
        const deleted = await deletePromo(command.number);
        await sendPromoReply(
          chatId,
          deleted
            ? `Карточка №${command.number} удалена.`
            : `Карточка №${command.number} не найдена.`,
        );
        return;
      }
      case "pin": {
        const promo = await pinPromo(command.number);
        await sendPromoReply(
          chatId,
          promo
            ? `Карточка №${promo.number} закреплена в начале.`
            : `Карточка №${command.number} не найдена.`,
        );
        return;
      }
      case "ignore":
        // Фото без подписи — частый случай: подсказываем, как оформить
        // карточку, вместо общего «не понял команду».
        await sendPromoReply(
          chatId,
          message.photo
            ? "У фото нет подписи. Пришлите фото ещё раз с подписью: первая строка — заголовок карточки, последняя строка-ссылка (/catalog или https://…) — кнопка."
            : "Не понял команду. /help — список команд.",
        );
        return;
    }
  } catch (error) {
    console.error(
      "Promo bot command failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    await sendPromoReply(
      chatId,
      "Команда не выполнена (ошибка). Попробуйте ещё раз.",
    );
  }
}

// Идемпотентность апдейтов: Telegram повторяет неотверждённые вебхуки, а
// поллинг при рестарте может получить уже обработанное сообщение.
const seenUpdates = new Set<number>();
const seenOrder: number[] = [];
const SEEN_LIMIT = 128;

/** Обработка с защитой от дублей; никогда не бросает (вебхук всегда 200). */
export async function handlePromoUpdateOnce(
  update: TelegramUpdate,
): Promise<void> {
  if (!Number.isInteger(update.update_id)) return;
  if (seenUpdates.has(update.update_id)) return;
  seenUpdates.add(update.update_id);
  seenOrder.push(update.update_id);
  if (seenOrder.length > SEEN_LIMIT) {
    const dropped = seenOrder.splice(0, seenOrder.length - SEEN_LIMIT);
    for (const id of dropped) seenUpdates.delete(id);
  }
  try {
    await handlePromoUpdate(update);
  } catch (error) {
    console.error(
      "Promo update processing failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

/** getUpdates для поллинга (вебхук при этом должен быть снят). */
export async function fetchPromoUpdates(
  offset: number,
  timeoutSec = 25,
): Promise<TelegramUpdate[]> {
  const payload = (await telegramApi(
    "getUpdates",
    {
      timeout: timeoutSec,
      offset,
      allowed_updates: '["message"]',
    },
    // запас 3 с сверх long-poll, чтобы запрос не резался общим лимитом
    timeoutSec * 1000 + 3000,
  )) as { result?: TelegramUpdate[] };
  return payload.result ?? [];
}

/** Только для тестов: сброс защиты от дублей апдейтов. */
export function resetPromoBotForTests(): void {
  seenUpdates.clear();
  seenOrder.length = 0;
}

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import {
  createPromo,
  deletePromo,
  listPromos,
  pinPromo,
  setPromoStatus,
  PROMO_MEDIA_DIR,
} from "./promo-store";
import { telegramSilenced } from "../utils/telegram-silence";

/**
 * Бот промо-акций (@…, токен в TELEGRAM_PROMO_BOT_TOKEN): наполняет блок
 * «Акции и предложения» на главной. Управление — сообщениями из allowlist
 * TELEGRAM_PROMO_CHAT_IDS: обычное сообщение (или фото с подписью) создаёт
 * карточку, команды /list /on N /off N /del N /pin N /help управляют ею.
 *
 * Каналы приёма команд: вебхук POST /api/telegram/promo/webhook (прод —
 * хостер блокирует исходящие к api.telegram.org, входящие работают) и
 * getUpdates-поллинг TELEGRAM_PROMO_POLLING=1 (dev/локально). Ответы бота —
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
    photo?: Array<{ file_id: string; file_size?: number }>;
  };
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
): Promise<unknown> {
  const token = promoBotToken();
  if (!token) throw new Error("Promo bot token is not configured");
  if (telegramSilenced()) throw new Error("Telegram silenced for tests");
  const url = new URL(`https://api.telegram.org/bot${token}/${method}`);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
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
  | { kind: "create"; title: string; text: string; ctaHref: string | null }
  | { kind: "list" }
  | { kind: "help" }
  | { kind: "status"; status: "active" | "hidden"; number: number }
  | { kind: "delete"; number: number }
  | { kind: "pin"; number: number }
  | { kind: "ignore" };

/** Разбор сообщения оператора: команда или текст будущей карточки. */
export function parsePromoBotCommand(raw: string): PromoBotCommand {
  const text = raw.replace(/\r/g, "").trim();
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
  // текст; последняя строка-ссылка (/path или https://…) становится кнопкой.
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines.shift() ?? "";
  let ctaHref: string | null = null;
  const last = lines[lines.length - 1] ?? "";
  if (/^https:\/\/\S+$/i.test(last)) ctaHref = lines.pop() ?? null;
  else if (/^\/[a-z0-9\-./?#%=&]*$/i.test(last)) ctaHref = lines.pop() ?? null;
  return { kind: "create", title, text: lines.join("\n"), ctaHref };
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
  "",
  "Команды:",
  "/list — список карточек",
  "/off N — скрыть, /on N — вернуть",
  "/del N — удалить",
  "/pin N — закрепить в начале",
].join("\n");

/** Скачивание фото карточки во внутренний media-каталог хранилища. */
async function downloadPromoPhoto(fileId: string): Promise<string | null> {
  const token = promoBotToken();
  if (!token) return null;
  const info = (await telegramApi("getFile", { file_id: fileId })) as {
    result?: { file_path?: string };
  };
  const filePath = info.result?.file_path;
  if (!filePath) return null;
  const extension = filePath.split(".").at(-1)?.toLocaleLowerCase("ru");
  if (!["jpg", "jpeg", "png", "webp"].includes(extension ?? "")) return null;
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

/** Обработка одного апдейта: allowlist → команда → ответ оператору. */
export async function handlePromoUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message) return;
  const chatId = String(message.chat.id);
  if (!promoChatIds().includes(chatId)) return;
  const raw = message.text ?? message.caption ?? "";
  const command = parsePromoBotCommand(raw);
  try {
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
                `${promo.status === "active" ? "●" : "○"} №${promo.number} — ${promo.title}`,
            )
            .join("\n"),
        );
        return;
      }
      case "create": {
        const photo = message.photo?.at(-1);
        const mediaFile = photo
          ? ((await downloadPromoPhoto(photo.file_id)) ?? null)
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
  const payload = (await telegramApi("getUpdates", {
    timeout: timeoutSec,
    offset,
    allowed_updates: '["message"]',
  })) as { result?: TelegramUpdate[] };
  return payload.result ?? [];
}

/** Только для тестов: сброс защиты от дублей апдейтов. */
export function resetPromoBotForTests(): void {
  seenUpdates.clear();
  seenOrder.length = 0;
}

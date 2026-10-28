import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import type { PromoCard } from "../../shared/types/promo";
import { sanitizePromoHtml, telegramTextToHtml } from "./promo-format";

/**
 * Файловое хранилище промо-акций (JSON + атомарная запись), по образцу
 * reservation-store. Наполняется владельцем через Telegram-бота акций;
 * на сайте публикуются только активные карточки (см. api/promos.get.ts).
 * Демо-карточки для разработки добавляются только при PROMO_SEED_DEMO=1 —
 * прод окружение без переменной ничего не сидирует.
 */
export interface StoredPromo {
  id: string;
  /** Короткий номер для команд бота (/off N, /del N, /pin N). */
  number: number;
  title: string;
  text: string;
  /** Разметка Telegram (жирный/цитаты/ссылки) для сайта; null у старых карточек. */
  titleHtml: string | null;
  textHtml: string | null;
  badge: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  /** Имя файла в media-каталоге хранилища или null. */
  mediaFile: string | null;
  /** Статический эскиз видео-стикера (poster для <video>) или null. */
  mediaPosterFile: string | null;
  /** Фото-снимок оператора или стикер из Telegram. */
  mediaKind: "photo" | "sticker";
  status: "active" | "hidden";
  /** Порядок показа: меньше — раньше (команда /pin ставит в начало). */
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface PromoFile {
  version: 1;
  promos: StoredPromo[];
  /** Последний выданный номер карточки. */
  counter: number;
}

const DATA_DIR = resolve(
  process.cwd(),
  process.env.PROMO_DATA_DIR || ".data/promos",
);
const FILE = resolve(DATA_DIR, "promos.json");
export const PROMO_MEDIA_DIR = resolve(DATA_DIR, "media");

/** Лимиты карточки (символы чистого текста); парсер бота обрезает по ним. */
export const MAX_TITLE = 80;
export const MAX_TEXT = 500;

let file: PromoFile | undefined;
let queue: Promise<unknown> = Promise.resolve();
/** Холодное чтение одно на все параллельные вызовы: без этого несколько
 *  запросов к пустому хранилищу получали разные объекты и дублировали записи. */
let loading: Promise<PromoFile> | undefined;
/** Идущий демо-сид: параллельные GET /api/promos на пустом хранилище
 *  трижды видели «пусто» и накатывали по 3 карточки (наблюдалось 9 вместо 3). */
let seedInFlight: Promise<void> | undefined;

async function readStore(): Promise<PromoFile> {
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8")) as PromoFile;
    file =
      Array.isArray(parsed.promos) && typeof parsed.counter === "number"
        ? parsed
        : { version: 1, promos: [], counter: 0 };
  } catch {
    file = { version: 1, promos: [], counter: 0 };
  }
  return file;
}

async function load(): Promise<PromoFile> {
  if (file) return file;
  if (!loading) {
    loading = readStore().finally(() => {
      loading = undefined;
    });
  }
  return loading;
}

function persist(next: PromoFile): Promise<void> {
  const run = async () => {
    await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
    const temp = `${FILE}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(next), { mode: 0o600 });
    await rename(temp, FILE);
  };
  queue = queue.then(run, run);
  return queue as Promise<void>;
}

function normalizeText(value: string, max: number): string {
  // Управляющие символы вырезаются (анти-спуфинг, как в reservation-telegram).
  const stripped = Array.from(value)
    .map((char) =>
      char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? " " : char,
    )
    .join("");
  return stripped.replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Многострочная нормализация текста карточки: переносы строк сохраняются
 * (сайт показывает их «как в Телеграме»), схлопываются только пробелы и
 * табы внутри строки. Отображение всё равно идёт по textHtml — это поле
 * для /list, aria и совместимости.
 */
function normalizeMultilineText(value: string, max: number): string {
  const stripped = Array.from(value)
    .map((char) =>
      (char.charCodeAt(0) < 32 && char !== "\n") || char.charCodeAt(0) === 127
        ? ""
        : char,
    )
    .join("");
  return stripped
    .replace(/[^\S\n]+/g, " ")
    .trim()
    .slice(0, max);
}

/** Нормализация адреса кнопки: внутренний путь или https-ссылка. */
function normalizeHref(value: string): string | null {
  const trimmed = value.trim();
  if (/^\/[a-z0-9\-./?#%=&]*$/i.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:") return url.href;
  } catch {
    return null;
  }
  return null;
}

export interface CreatePromoInput {
  title: string;
  text?: string;
  /** Разметка Telegram; без неё HTML экранируется из плоского текста. */
  titleHtml?: string | null;
  textHtml?: string | null;
  badge?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  mediaFile?: string | null;
  mediaPosterFile?: string | null;
  mediaKind?: "photo" | "sticker";
}

export async function createPromo(
  input: CreatePromoInput,
): Promise<StoredPromo> {
  const data = await load();
  const now = new Date().toISOString();
  data.counter += 1;
  const promo: StoredPromo = {
    id: randomUUID(),
    number: data.counter,
    title: normalizeText(input.title, MAX_TITLE),
    text: normalizeMultilineText(input.text ?? "", MAX_TEXT),
    titleHtml: sanitizePromoHtml(
      input.titleHtml ?? telegramTextToHtml(input.title ?? "", []),
    ),
    textHtml: sanitizePromoHtml(
      input.textHtml ?? telegramTextToHtml(input.text ?? "", []),
    ),
    badge: input.badge ? normalizeText(input.badge, 24) : null,
    ctaLabel: input.ctaLabel ? normalizeText(input.ctaLabel, 32) : null,
    ctaHref: input.ctaHref ? normalizeHref(input.ctaHref) : null,
    mediaFile: input.mediaFile ?? null,
    mediaPosterFile: input.mediaPosterFile ?? null,
    mediaKind: input.mediaKind === "sticker" ? "sticker" : "photo",
    status: "active",
    order: -data.counter,
    createdAt: now,
    updatedAt: now,
  };
  data.promos.push(promo);
  await persist(data);
  return promo;
}

async function mutate(
  number: number,
  change: (promo: StoredPromo) => boolean,
): Promise<StoredPromo | undefined> {
  const data = await load();
  const promo = data.promos.find((item) => item.number === number);
  if (!promo) return undefined;
  if (!change(promo)) return promo;
  promo.updatedAt = new Date().toISOString();
  await persist(data);
  return promo;
}

export async function setPromoStatus(
  number: number,
  status: "active" | "hidden",
): Promise<StoredPromo | undefined> {
  return mutate(number, (promo) => {
    if (promo.status === status) return false;
    promo.status = status;
    return true;
  });
}

export async function deletePromo(number: number): Promise<boolean> {
  const data = await load();
  const index = data.promos.findIndex((item) => item.number === number);
  if (index === -1) return false;
  const [promo] = data.promos.splice(index, 1);
  await persist(data);
  // Файлы карточки больше никому не нужны — убираем, чтобы media-каталог
  // не рос от удалённых акций.
  if (promo?.mediaFile)
    await rm(join(PROMO_MEDIA_DIR, promo.mediaFile), { force: true });
  if (promo?.mediaPosterFile)
    await rm(join(PROMO_MEDIA_DIR, promo.mediaPosterFile), { force: true });
  return true;
}

/** Переставить карточку в начало ленты. */
export async function pinPromo(
  number: number,
): Promise<StoredPromo | undefined> {
  const data = await load();
  const promo = data.promos.find((item) => item.number === number);
  if (!promo) return undefined;
  const minOrder = Math.min(0, ...data.promos.map((item) => item.order));
  promo.order = minOrder - 1;
  promo.updatedAt = new Date().toISOString();
  await persist(data);
  return promo;
}

export async function listPromos(): Promise<StoredPromo[]> {
  const data = await load();
  return [...data.promos].sort(
    (a, b) => a.order - b.order || b.createdAt.localeCompare(a.createdAt),
  );
}

/**
 * Активные карточки в порядке показа — публичный контракт /api/promos.
 * Цветовая схема назначается по позиции в ленте (чётные — жёлтые): после
 * скрытий и удалений карточки всё равно чередуются, без дырок «жёлтая-жёлтая».
 */
export async function listActivePromos(): Promise<PromoCard[]> {
  const promos = await listPromos();
  return promos
    .filter((promo) => promo.status === "active")
    .map((promo, index) => ({
      id: promo.id,
      title: promo.title,
      text: promo.text,
      // У карточек, сохранённых до поддержки разметки, HTML нет — текст
      // экранируется как есть (переносы покажет white-space: pre-wrap).
      titleHtml: promo.titleHtml ?? telegramTextToHtml(promo.title, []),
      textHtml: promo.textHtml ?? telegramTextToHtml(promo.text, []),
      badge: promo.badge,
      ctaLabel: promo.ctaLabel ?? (promo.ctaHref ? "Открыть" : null),
      ctaHref: promo.ctaHref,
      image: promo.mediaFile ? `/api/promos/${promo.id}/image` : null,
      imagePoster: promo.mediaPosterFile
        ? `/api/promos/${promo.id}/image?variant=poster`
        : null,
      mediaKind: promo.mediaKind ?? "photo",
      accent: index % 2 === 0 ? ("yellow" as const) : ("ink" as const),
    }));
}

/**
 * Демо-карточки для разработки и e2e: только при PROMO_SEED_DEMO=1 и только
 * в пустое хранилище — реальные акции приходят через бота, прод не сидируется.
 */
export function seedDemoPromosIfEmpty(): Promise<void> {
  // single-flight: пока сид работает, повторные вызовы ждут его, а не
  // начинают параллельную проверку пустоты (гонка check-then-act).
  seedInFlight ??= seedDemoPromosOnce().finally(() => {
    seedInFlight = undefined;
  });
  return seedInFlight;
}

async function seedDemoPromosOnce(): Promise<void> {
  if (process.env.PROMO_SEED_DEMO !== "1") return;
  const data = await load();
  if (data.promos.length) return;
  await createPromo({
    title: "Тестовая акция №1: −20% на китайский чай",
    titleHtml: "Тестовая акция №1: <strong>−20%</strong> на китайский чай",
    text: "Демо-карточка для разработки:\nжирный, курсив и цитата — как в Telegram.\nВсего 490 ₽ вместо 690 ₽.\nНа проде показываются только реальные акции из бота.",
    textHtml:
      'Демо-карточка для разработки: <strong>жирный</strong>, <em>курсив</em> и цитата — как в Telegram.\nВсего <span class="tg-price">490 ₽</span> вместо <span class="tg-price">690 ₽</span>.\n<blockquote>На проде показываются только реальные акции из бота.</blockquote>',
    badge: "ТЕСТ",
    ctaHref: "/catalog",
  });
  await createPromo({
    title: "Тестовое предложение №2: новый ассортимент снеков",
    text: "Вторая демо-карточка карусели — проверка автопрокрутки и индикатора.",
    badge: "ТЕСТ",
    ctaHref: "/catalog",
  });
  await createPromo({
    title: "Тестовая новинка №3: ароматы месяца",
    text: "Третья демо-карточка — цикл карусели начинается заново.",
    badge: "ТЕСТ",
    ctaHref: "/catalog",
  });
}

/** Только для тестов: сброс кэша файла. */
export function resetPromoStoreForTests(): void {
  file = undefined;
  loading = undefined;
}

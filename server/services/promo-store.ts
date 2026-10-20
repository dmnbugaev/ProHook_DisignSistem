import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import type { PromoCard } from "../../shared/types/promo";

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
  badge: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  /** Имя файла в media-каталоге хранилища или null. */
  mediaFile: string | null;
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

const MAX_TITLE = 80;
const MAX_TEXT = 500;

let file: PromoFile | undefined;
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<PromoFile> {
  if (file) return file;
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
  badge?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  mediaFile?: string | null;
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
    text: normalizeText(input.text ?? "", MAX_TEXT),
    badge: input.badge ? normalizeText(input.badge, 24) : null,
    ctaLabel: input.ctaLabel ? normalizeText(input.ctaLabel, 32) : null,
    ctaHref: input.ctaHref ? normalizeHref(input.ctaHref) : null,
    mediaFile: input.mediaFile ?? null,
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
  // Файл карточки больше никому не нужен — убираем, чтобы media-каталог
  // не рос от удалённых акций.
  if (promo?.mediaFile)
    await rm(join(PROMO_MEDIA_DIR, promo.mediaFile), { force: true });
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
      badge: promo.badge,
      ctaLabel: promo.ctaLabel ?? (promo.ctaHref ? "Открыть" : null),
      ctaHref: promo.ctaHref,
      image: promo.mediaFile ? `/api/promos/${promo.id}/image` : null,
      accent: index % 2 === 0 ? ("yellow" as const) : ("ink" as const),
    }));
}

/**
 * Демо-карточки для разработки и e2e: только при PROMO_SEED_DEMO=1 и только
 * в пустое хранилище — реальные акции приходят через бота, прод не сидируется.
 */
export async function seedDemoPromosIfEmpty(): Promise<void> {
  if (process.env.PROMO_SEED_DEMO !== "1") return;
  const data = await load();
  if (data.promos.length) return;
  await createPromo({
    title: "Тестовая акция №1: −20% на китайский чай",
    text: "Демо-карточка для разработки: на проде показываются только реальные акции из Telegram-бота.",
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
}

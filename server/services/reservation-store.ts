import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { ReservationStatus } from "../../shared/types/reservation";

/**
 * Файловое хранилище запросов на резерв (JSON + атомарная запись), по
 * образцу user-store. Данные ПД (имя, телефон, комментарий) хранятся только
 * здесь, в .data/reservations вне Git (режим 0600), и удаляются по истечении
 * срока хранения RETENTION_DAYS. Telegram — только уведомление, не хранилище:
 * сбой доставки не удаляет и не обесценивает запрос.
 */
export interface StoredReservationItem {
  /** id товара МойСклад (внешний id совпадает с id каталога). */
  productId: string;
  productNameSnapshot: string;
  quantity: number;
}

export interface StoredReservation {
  id: string;
  /** Публичный номер вида R-XXXXXX для сотрудника и покупателя. */
  publicId: string;
  userId: string | null;
  customerName: string;
  /** Нормализованный телефон: 7XXXXXXXXXX. */
  phone: string;
  storeId: string;
  storeNameSnapshot: string;
  storeAddressSnapshot: string;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
  /** Срок обработки запроса магазином; после — EXPIRED. */
  expiresAt: string;
  comment: string;
  consent: { personalData: boolean; telegram: boolean; capturedAt: string };
  captchaVerifiedAt: string | null;
  items: StoredReservationItem[];
  /**
   * Проба монитор-бота (секрет x-monitor-secret): создана автоматикой,
   * не рассылается в Telegram и не участвует в нумерации заявок за день.
   * Опционально — записи до 10.11.2026 (считаются реальными).
   */
  monitorProbe?: boolean;
  telegramDelivery: {
    attempts: number;
    deliveredTo: string[];
    /**
     * Чаты с фатальным отказом Telegram (403 / «chat not found»):
     * ретраи в них отключены. Опционально — записи до 10.11.2026.
     */
    fatalTo?: string[];
    lastAttemptAt: string | null;
  };
}

interface ReservationFile {
  version: 1;
  requests: StoredReservation[];
}

const DATA_DIR = resolve(
  process.cwd(),
  process.env.RESERVATION_DATA_DIR || ".data/reservations",
);
const FILE = resolve(DATA_DIR, "reservations.json");

/** Сколько времени запрос ждёт обработки магазином. */
export const RESERVATION_TTL_MS = 24 * 60 * 60 * 1000;
/** Срок хранения персональных данных запроса (минимизация, 152-ФЗ). */
export const RESERVATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// Без неоднозначных символов, чтобы номер можно было диктовать по телефону.
const PUBLIC_ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

let file: ReservationFile | undefined;
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<ReservationFile> {
  if (file) return file;
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8")) as ReservationFile;
    file = Array.isArray(parsed.requests)
      ? parsed
      : { version: 1, requests: [] };
  } catch {
    file = { version: 1, requests: [] };
  }
  return file;
}

function persist(next: ReservationFile): Promise<void> {
  const run = async () => {
    await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
    const temp = `${FILE}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(next), { mode: 0o600 });
    await rename(temp, FILE);
  };
  queue = queue.then(run, run);
  return queue as Promise<void>;
}

function newPublicId(): string {
  let id = "";
  for (let index = 0; index < 6; index++)
    id +=
      PUBLIC_ID_ALPHABET[Math.floor(Math.random() * PUBLIC_ID_ALPHABET.length)];
  return `R-${id}`;
}

/** Чистка при записи: удаление данных старше срока хранения и EXPIRED. */
function sweep(data: ReservationFile, now: number) {
  const before = data.requests.length;
  data.requests = data.requests.filter((request) => {
    const created = Date.parse(request.createdAt);
    if (!Number.isFinite(created)) return false;
    if (now - created > RESERVATION_RETENTION_MS) return false;
    if (request.status === "PENDING" && Date.parse(request.expiresAt) <= now)
      request.status = "EXPIRED";
    return true;
  });
  return data.requests.length !== before;
}

export async function createReservation(input: {
  userId: string | null;
  customerName: string;
  phone: string;
  storeId: string;
  storeNameSnapshot: string;
  storeAddressSnapshot: string;
  comment: string;
  consent: { personalData: boolean; telegram: boolean };
  captchaVerifiedAt: string | null;
  items: StoredReservationItem[];
  /** Проба монитор-бота: true у автоматических проверок. */
  monitorProbe?: boolean;
}): Promise<StoredReservation> {
  const data = await load();
  const now = Date.now();
  sweep(data, now);
  const usedIds = new Set(data.requests.map((request) => request.publicId));
  let publicId = newPublicId();
  while (usedIds.has(publicId)) publicId = newPublicId();
  const request: StoredReservation = {
    id: randomUUID(),
    publicId,
    userId: input.userId,
    customerName: input.customerName,
    phone: input.phone,
    storeId: input.storeId,
    storeNameSnapshot: input.storeNameSnapshot,
    storeAddressSnapshot: input.storeAddressSnapshot,
    status: "PENDING",
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + RESERVATION_TTL_MS).toISOString(),
    comment: input.comment,
    consent: { ...input.consent, capturedAt: new Date(now).toISOString() },
    captchaVerifiedAt: input.captchaVerifiedAt,
    items: input.items,
    monitorProbe: input.monitorProbe ?? false,
    telegramDelivery: { attempts: 0, deliveredTo: [], lastAttemptAt: null },
  };
  data.requests.push(request);
  await persist(data);
  return request;
}

export async function findReservationByPublicId(
  publicId: string,
): Promise<StoredReservation | undefined> {
  const data = await load();
  return data.requests.find((request) => request.publicId === publicId);
}

/** Свежие запросы первыми — для инбокса сотрудников. */
export async function listReservations(
  limit = 50,
): Promise<StoredReservation[]> {
  const data = await load();
  return [...data.requests]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/** Ключ дня по времени Саратова (YYYY-MM-DD) — сеть базируется там. */
function saratovDayKey(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Saratov",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/**
 * Проба монитор-бота? Флаг monitorProbe ставится при создании с 10.11.2026;
 * записи старше распознаются по официальным маркерам заявки монитор-бота
 * (мандат 20.10.2026: тестовые заявки помечаются «ТЕСТ» в имени) — имя и
 * служебный телефон вместе исключают ложное совпадение с реальным
 * клиентом, случайно назвавшимся так же.
 */
function isMonitorProbeRecord(item: StoredReservation): boolean {
  return (
    item.monitorProbe === true ||
    (item.customerName === "ТЕСТ Мониторинг" && item.phone === "79990000000")
  );
}

/**
 * Порядковый номер заявки внутри её дня по времени Саратова: сколько
 * запросов этого дня создано не позже указанного (включая его самого).
 * Пробы монитор-бота (ежечасные) в нумерации не участвуют — номер
 * считает только реальные заявки сотрудников-клиентов.
 * ISO-строки сравниваются лексикографически — формат записи одинаков.
 */
export async function reservationDailyIndex(
  reservation: StoredReservation,
): Promise<number> {
  const data = await load();
  const day = saratovDayKey(reservation.createdAt);
  if (!day) return 0;
  let index = 0;
  for (const item of data.requests) {
    if (isMonitorProbeRecord(item)) continue;
    if (
      saratovDayKey(item.createdAt) === day &&
      item.createdAt <= reservation.createdAt
    )
      index++;
  }
  return index;
}

/** Фиксация попытки доставки в Telegram (без ПД в логах). */
export async function recordTelegramAttempt(
  id: string,
  deliveredTo: string[],
  fatalTo: string[] = [],
): Promise<void> {
  const data = await load();
  const request = data.requests.find((item) => item.id === id);
  if (!request) return;
  request.telegramDelivery.attempts += 1;
  request.telegramDelivery.lastAttemptAt = new Date().toISOString();
  for (const chatId of deliveredTo)
    if (!request.telegramDelivery.deliveredTo.includes(chatId))
      request.telegramDelivery.deliveredTo.push(chatId);
  request.telegramDelivery.fatalTo ??= [];
  for (const chatId of fatalTo)
    if (!request.telegramDelivery.fatalTo.includes(chatId))
      request.telegramDelivery.fatalTo.push(chatId);
  request.updatedAt = new Date().toISOString();
  await persist(data);
}

/** Только для тестов: сброс кэша файла (прямой доступ к каталогу данных). */
export function resetReservationStoreForTests(): void {
  file = undefined;
}

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { Partnership } from "../../shared/utils/partnership";

/**
 * Файловое хранилище заявок на партнёрство (JSON + атомарная запись), по
 * образцу reservation-store. Заявка сохраняется ДО попытки доставки в
 * Telegram: сбой доставки (например, хостинг блокирует api.telegram.org)
 * не теряет заявку и не возвращает ошибку отправителю. Данные ПД хранятся
 * только здесь, в .data/partnership вне Git (режим 0600), и удаляются по
 * истечении срока хранения RETENTION_MS.
 */
export interface StoredPartnership {
  id: string;
  /** Публичный номер вида P-XXXXXX для сотрудника и заявителя. */
  publicId: string;
  name: string;
  phone: string;
  city: string;
  company: string;
  offer: string;
  consent: { personalData: boolean; telegram: boolean; capturedAt: string };
  createdAt: string;
  telegramDelivery: {
    attempts: number;
    deliveredTo: string[];
    lastAttemptAt: string | null;
  };
}

interface PartnershipFile {
  version: 1;
  applications: StoredPartnership[];
}

const DATA_DIR = resolve(
  process.cwd(),
  process.env.PARTNERSHIP_DATA_DIR || ".data/partnership",
);
const FILE = resolve(DATA_DIR, "applications.json");

/** Срок хранения персональных данных заявки (минимизация, 152-ФЗ). */
export const PARTNERSHIP_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// Без неоднозначных символов, чтобы номер можно было продиктовать по телефону.
const PUBLIC_ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

let file: PartnershipFile | undefined;
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<PartnershipFile> {
  if (file) return file;
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8")) as PartnershipFile;
    file = Array.isArray(parsed.applications)
      ? parsed
      : { version: 1, applications: [] };
  } catch {
    file = { version: 1, applications: [] };
  }
  return file;
}

function persist(next: PartnershipFile): Promise<void> {
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
  return `P-${id}`;
}

/** Чистка при записи: удаление данных старше срока хранения. */
function sweep(data: PartnershipFile, now: number) {
  const before = data.applications.length;
  data.applications = data.applications.filter((application) => {
    const created = Date.parse(application.createdAt);
    return (
      Number.isFinite(created) && now - created <= PARTNERSHIP_RETENTION_MS
    );
  });
  return data.applications.length !== before;
}

export async function createPartnership(
  data: Partnership,
): Promise<StoredPartnership> {
  const store = await load();
  const now = Date.now();
  sweep(store, now);
  const usedIds = new Set(
    store.applications.map((application) => application.publicId),
  );
  let publicId = newPublicId();
  while (usedIds.has(publicId)) publicId = newPublicId();
  const application: StoredPartnership = {
    id: randomUUID(),
    publicId,
    name: data.name,
    phone: data.phone,
    city: data.city,
    company: data.company,
    offer: data.offer,
    consent: {
      personalData: data.consent,
      telegram: data.consentTelegram,
      capturedAt: new Date(now).toISOString(),
    },
    createdAt: new Date(now).toISOString(),
    telegramDelivery: { attempts: 0, deliveredTo: [], lastAttemptAt: null },
  };
  store.applications.push(application);
  await persist(store);
  return application;
}

/** Свежие заявки первыми — для инбокса сотрудников. */
export async function listPartnerships(
  limit = 50,
): Promise<StoredPartnership[]> {
  const store = await load();
  return [...store.applications]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/** Фиксация попытки доставки в Telegram (без ПД в логах). */
export async function recordPartnershipAttempt(
  id: string,
  deliveredTo: string[],
): Promise<void> {
  const store = await load();
  const application = store.applications.find((item) => item.id === id);
  if (!application) return;
  application.telegramDelivery.attempts += 1;
  application.telegramDelivery.lastAttemptAt = new Date().toISOString();
  for (const chatId of deliveredTo)
    if (!application.telegramDelivery.deliveredTo.includes(chatId))
      application.telegramDelivery.deliveredTo.push(chatId);
  await persist(store);
}

/** Только для тестов: сброс кэша файла. */
export function resetPartnershipStoreForTests(): void {
  file = undefined;
}

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";

/**
 * Файловое хранилище сессий. В cookie уходит случайный токен; на диске
 * хранится только его SHA-256, поэтому утечка файла не даёт угон сессий.
 * TTL 30 дней; истёкшие сессии чистятся при каждой записи.
 */
export interface StoredSession {
  /** SHA-256 токена сессии в hex. */
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: number;
}

interface SessionFile {
  version: 1;
  sessions: StoredSession[];
}

const DATA_DIR = resolve(
  process.cwd(),
  process.env.ACCOUNT_DATA_DIR || ".data/account",
);
const SESSIONS_FILE = resolve(DATA_DIR, "sessions.json");
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = "prohook-session";

let file: SessionFile | undefined;
let queue: Promise<unknown> = Promise.resolve();

function tokenId(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function load(): Promise<SessionFile> {
  if (file) return file;
  try {
    const parsed = JSON.parse(
      await readFile(SESSIONS_FILE, "utf8"),
    ) as SessionFile;
    file = Array.isArray(parsed.sessions)
      ? parsed
      : { version: 1, sessions: [] };
  } catch {
    file = { version: 1, sessions: [] };
  }
  return file;
}

function persist(next: SessionFile): Promise<void> {
  const run = async () => {
    await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
    const temp = `${SESSIONS_FILE}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(next), { mode: 0o600 });
    await rename(temp, SESSIONS_FILE);
  };
  queue = queue.then(run, run);
  return queue as Promise<void>;
}

/** Создаёт сессию и возвращает токен для HttpOnly cookie. */
export async function createSession(userId: string): Promise<string> {
  const data = await load();
  const now = Date.now();
  data.sessions = data.sessions.filter((session) => session.expiresAt > now);
  const token = randomBytes(32).toString("hex");
  data.sessions.push({
    id: tokenId(token),
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: now + SESSION_TTL_MS,
  });
  await persist(data);
  return token;
}

export async function getSession(
  token: string,
): Promise<StoredSession | undefined> {
  if (!/^[a-f0-9]{64}$/.test(token)) return undefined;
  const data = await load();
  const session = data.sessions.find(
    (item) => item.id === tokenId(token) && item.expiresAt > Date.now(),
  );
  return session;
}

/** Инвалидация сессии при logout (без ошибки, если её уже нет). */
export async function deleteSession(token: string): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(token)) return;
  const data = await load();
  const id = tokenId(token);
  const now = Date.now();
  const before = data.sessions.length;
  data.sessions = data.sessions.filter(
    (session) => session.id !== id && session.expiresAt > now,
  );
  if (data.sessions.length !== before) await persist(data);
}

import { hash, verify } from "@node-rs/argon2";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { resolve } from "node:path";

/**
 * Файловое хранилище пользователей (JSON + атомарная запись), по образцу
 * снимка каталога. Каталог в .cache регенерируем, аккаунты — нет, поэтому
 * отдельная директория ACCOUNT_DATA_DIR (.data/account, вне Git).
 * Один экземпляр сервера; для нескольких реплик нужна общая БД.
 */
export interface StoredUser {
  id: string;
  phone: string;
  lastName: string;
  firstName: string;
  middleName: string;
  /** ISO: YYYY-MM-DD. */
  dateOfBirth: string;
  passwordHash: string;
  /** Стабильный user_id карты клиента Тейка или null. */
  teycaClientId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserFile {
  version: 1;
  users: StoredUser[];
}

const DATA_DIR = resolve(
  process.cwd(),
  process.env.ACCOUNT_DATA_DIR || ".data/account",
);
const USERS_FILE = resolve(DATA_DIR, "users.json");

// Argon2id с параметрами уровня OWASP (19 MiB, t=2, p=1).
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

let file: UserFile | undefined;
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<UserFile> {
  if (file) return file;
  try {
    const parsed = JSON.parse(await readFile(USERS_FILE, "utf8")) as UserFile;
    file = Array.isArray(parsed.users) ? parsed : { version: 1, users: [] };
  } catch {
    file = { version: 1, users: [] };
  }
  return file;
}

/** Последовательная атомарная запись, чтобы запросы не теряли изменения. */
function persist(next: UserFile): Promise<void> {
  const run = async () => {
    await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
    const temp = `${USERS_FILE}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(next), { mode: 0o600 });
    await rename(temp, USERS_FILE);
  };
  queue = queue.then(run, run);
  return queue as Promise<void>;
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password);
}

/** Проверка пароля с постоянным временем для несуществующих пользователей. */
let timingDummy: string | undefined;
export async function verifyDummyPassword(password: string): Promise<void> {
  timingDummy ??= await hash(randomBytes(32).toString("hex"), ARGON2_OPTIONS);
  await verify(timingDummy, password);
}

export async function findUserByPhone(
  phone: string,
): Promise<StoredUser | undefined> {
  const data = await load();
  return data.users.find((user) => user.phone === phone);
}

export async function findUserById(
  id: string,
): Promise<StoredUser | undefined> {
  const data = await load();
  return data.users.find((user) => user.id === id);
}

export async function findUserByTeycaId(
  teycaClientId: string,
): Promise<StoredUser | undefined> {
  const data = await load();
  return data.users.find((user) => user.teycaClientId === teycaClientId);
}

export async function createUser(profile: {
  phone: string;
  lastName: string;
  firstName: string;
  middleName: string;
  dateOfBirth: string;
  password: string;
}): Promise<StoredUser> {
  const data = await load();
  if (data.users.some((user) => user.phone === profile.phone))
    throw new Error("Phone already registered");
  const now = new Date().toISOString();
  const user: StoredUser = {
    id: randomUUID(),
    phone: profile.phone,
    lastName: profile.lastName,
    firstName: profile.firstName,
    middleName: profile.middleName,
    dateOfBirth: profile.dateOfBirth,
    passwordHash: await hashPassword(profile.password),
    teycaClientId: null,
    createdAt: now,
    updatedAt: now,
  };
  data.users.push(user);
  await persist(data);
  return user;
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<StoredUser, "teycaClientId">>,
): Promise<StoredUser | undefined> {
  const data = await load();
  const user = data.users.find((item) => item.id === id);
  if (!user) return undefined;
  Object.assign(user, patch, { updatedAt: new Date().toISOString() });
  await persist(data);
  return user;
}

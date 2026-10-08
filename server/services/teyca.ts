import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

/**
 * TeycaService — единственное место интеграции с бонусной системой TEYCA
 * (https://api.teyca.ru). Вызывается только из server API.
 *
 * Авторизация (см. официальную документацию TEYCA API):
 *  - основной ключ API передаётся в заголовке Authorization;
 *  - на каждый экземпляр стороннего сервера выдаётся отдельный токен
 *    (GET/POST /v1/authorization), он подставляется в путь /v1/{token}/…;
 *    повторное использование одного токена с нескольких экземпляров
 *    блокируется сервером TEYCA.
 *
 * Ключ и токен никогда не попадают в ответы, логи и клиентский код.
 * Ошибки схлопываются до типизированных результатов без деталей наружу,
 * техническое сообщение пишется в server-log без секретов.
 */
const TEYCA_API = "https://api.teyca.ru";
const REQUEST_TIMEOUT_MS = 8000;
const TOKEN_IDENTIFIER = process.env.TEYCA_IDENTIFIER || "prohook-website";

export type TeycaResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "not-configured" | "unavailable" };

export interface TeycaPass {
  userId: string;
  /** Баллы приходят строкой («100») — приводим к числу. */
  balance: number;
  loyaltyLevel?: string;
  discount?: string;
  phone?: string;
}

function apiKey(): string | undefined {
  const key =
    process.env.TEYCA_API_KEY ||
    (process.env.NUXT_TEYCA_API_KEY || "").trim() ||
    undefined;
  return key || undefined;
}

const TOKEN_FILE = resolve(
  process.cwd(),
  process.env.ACCOUNT_DATA_DIR || ".data/account",
  "teyca-token.json",
);

let cachedToken: { token: string } | undefined;
let tokenPromise: Promise<string | undefined> | undefined;

async function saveToken(token: string): Promise<void> {
  try {
    await mkdir(dirname(TOKEN_FILE), { recursive: true, mode: 0o700 });
    const temp = `${TOKEN_FILE}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify({ token }), { mode: 0o600 });
    await rename(temp, TOKEN_FILE);
  } catch {
    // Токен не критичен — при следующем запуске получим заново.
  }
}

/**
 * Токен экземпляра: готовый из TEYCA_API_TOKEN, иначе ищем свой
 * идентификатор в списке, иначе создаём и сохраняем локально.
 * fetchImpl подставляется только в тестах.
 */
async function instanceToken(
  fetchImpl: FetchLike = fetch,
): Promise<string | undefined> {
  const preset = (process.env.TEYCA_API_TOKEN || "").trim();
  if (preset) return preset;
  if (cachedToken) return cachedToken.token;
  if (tokenPromise) return tokenPromise;
  tokenPromise = (async () => {
    const key = apiKey();
    if (!key) return undefined;
    try {
      if (!cachedToken) {
        try {
          const cached = JSON.parse(await readFile(TOKEN_FILE, "utf8")) as {
            token?: string;
          };
          if (typeof cached.token === "string" && cached.token)
            cachedToken = { token: cached.token };
        } catch {
          // Файла ещё нет — создадим ниже.
        }
      }
      if (cachedToken) return cachedToken.token;
      const list = await request(
        "/v1/authorization",
        key,
        "GET",
        undefined,
        fetchImpl,
      );
      const entries = asArray(list.authorization);
      const existing = entries.find(
        (entry) => fieldOf(entry, "identifier") === TOKEN_IDENTIFIER,
      );
      const existingToken = fieldOf(existing, "token");
      if (existingToken) {
        cachedToken = { token: existingToken };
        await saveToken(existingToken);
        return existingToken;
      }
      const created = await request(
        "/v1/authorization",
        key,
        "POST",
        { identifier: TOKEN_IDENTIFIER },
        fetchImpl,
      );
      const token =
        fieldOf(created, "token") ??
        asArray(created.authorization)
          .map((entry) => fieldOf(entry, "token"))
          .find(Boolean);
      if (!token) throw new Error("Teyca did not return an instance token");
      cachedToken = { token };
      await saveToken(token);
      return token;
    } catch (error) {
      logFailure("instance token", error);
      return undefined;
    } finally {
      tokenPromise = undefined;
    }
  })();
  return tokenPromise;
}

type TeycaRecord = Record<string, unknown>;

function asArray(value: unknown): TeycaRecord[] {
  const list = Array.isArray(value) ? value : value != null ? [value] : [];
  return list.filter(
    (entry): entry is TeycaRecord =>
      entry != null && typeof entry === "object" && !Array.isArray(entry),
  );
}

function fieldOf(
  entry: TeycaRecord | undefined,
  key: string,
): string | undefined {
  const value = entry?.[key];
  return typeof value === "string" && value ? value : undefined;
}

/** Технический лог без ключей, токенов и телефонов. */
function logFailure(context: string, error: unknown) {
  console.error(
    `Teyca ${context} failed:`,
    error instanceof Error ? error.message : "unknown error",
  );
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

async function request(
  path: string,
  key: string,
  method: "GET" | "POST",
  body?: unknown,
  fetchImpl: FetchLike = fetch,
): Promise<Record<string, unknown>> {
  const response = await fetchImpl(`${TEYCA_API}${path}`, {
    method,
    headers: {
      Authorization: key,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok)
    throw new Error(`HTTP ${response.status} from ${path.split("?")[0]}`);
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Non-JSON response from ${path.split("?")[0]}`);
  }
}

function toPass(entry: Record<string, unknown> | undefined): TeycaPass | null {
  const userId = entry?.user_id;
  if (typeof userId !== "string" || !userId) return null;
  const bonus = Number.parseInt(String(entry.bonus ?? "0"), 10);
  const pass: TeycaPass = {
    userId,
    balance: Number.isFinite(bonus) ? bonus : 0,
  };
  if (typeof entry.loyalty_level === "string" && entry.loyalty_level)
    pass.loyaltyLevel = entry.loyalty_level;
  if (typeof entry.discount === "string" && entry.discount)
    pass.discount = entry.discount;
  if (typeof entry.phone === "string" && entry.phone) pass.phone = entry.phone;
  return pass;
}

/** Поиск карты клиента по нормализованному телефону 7XXXXXXXXXX. */
export async function findTeycaClientIdByPhone(
  phone: string,
  fetchImpl: FetchLike = fetch,
): Promise<TeycaResult<{ userId: string }>> {
  const key = apiKey();
  if (!key) return { ok: false, reason: "not-configured" };
  const token = await instanceToken(fetchImpl);
  if (!token) return { ok: false, reason: "unavailable" };
  // TEYCA хранит телефоны в форматах 7… и 8…; пробуем оба варианта.
  for (const variant of [phone, `8${phone.slice(1)}`]) {
    try {
      const path = `/v1/${token}/passes?search=phone%3D${variant}&limit=20&offset=0`;
      const response = await request(path, key, "GET", undefined, fetchImpl);
      const candidates = asArray(response.passes)
        .map((entry) => toPass(entry))
        .filter((pass): pass is TeycaPass => pass != null);
      const digits = (value: string | undefined) => value?.replace(/\D/g, "");
      const match =
        candidates.find((pass) => digits(pass.phone) === phone) ??
        (candidates.length === 1 ? candidates[0] : undefined);
      if (match) return { ok: true, value: { userId: match.userId } };
    } catch (error) {
      logFailure("client search", error);
      return { ok: false, reason: "unavailable" };
    }
  }
  return { ok: true, value: { userId: "" } };
}

/** Карта клиента по стабильному user_id: баланс берётся только отсюда. */
export async function getTeycaPassByUserId(
  userId: string,
  fetchImpl: FetchLike = fetch,
): Promise<TeycaResult<TeycaPass>> {
  const key = apiKey();
  if (!key) return { ok: false, reason: "not-configured" };
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(userId))
    return { ok: false, reason: "unavailable" };
  const token = await instanceToken(fetchImpl);
  if (!token) return { ok: false, reason: "unavailable" };
  try {
    const response = await request(
      `/v1/${token}/passes/userid/${encodeURIComponent(userId)}`,
      key,
      "GET",
      undefined,
      fetchImpl,
    );
    const pass = toPass(response);
    if (!pass) return { ok: false, reason: "unavailable" };
    return { ok: true, value: pass };
  } catch (error) {
    logFailure("balance fetch", error);
    return { ok: false, reason: "unavailable" };
  }
}

/** Проверка настройки без раскрытия ключа. */
export function isTeycaConfigured(): boolean {
  return apiKey() != null;
}

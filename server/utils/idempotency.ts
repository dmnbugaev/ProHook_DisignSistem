/**
 * Идемпотентность POST-запросов по заголовку Idempotency-Key: повторная
 * отправка (double click, retry клиента, медленная сеть) возвращает тот же
 * результат, не создавая вторую запись. Хранилище в памяти процесса —
 * проект односерверный (см. server/services/user-store.ts).
 */
const TTL_MS = 15 * 60 * 1000;
const MAX_KEYS = 10000;
const seen = new Map<string, { publicId: string; expires: number }>();

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function idempotentResult(key: string, now = Date.now()): string | null {
  const entry = seen.get(key);
  if (!entry) return null;
  if (entry.expires <= now) {
    seen.delete(key);
    return null;
  }
  return entry.publicId;
}

export function rememberIdempotentResult(
  key: string,
  publicId: string,
  now = Date.now(),
): void {
  if (seen.size >= MAX_KEYS) {
    for (const [existing, entry] of seen)
      if (entry.expires <= now) seen.delete(existing);
    if (seen.size >= MAX_KEYS) seen.clear();
  }
  seen.set(key, { publicId, expires: now + TTL_MS });
}

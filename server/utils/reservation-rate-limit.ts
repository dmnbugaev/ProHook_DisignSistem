// Per-process protection. Use a shared limiter at the proxy for multiple replicas.
// Порог можно поднять в тестах через RESERVATION_RATE_LIMIT_MAX
// (по образцу AUTH_RATE_LIMIT_* в playwright.config.ts).
const requests = new Map<string, { count: number; expires: number }>();
function maxAttempts(): number {
  const value = Number(process.env.RESERVATION_RATE_LIMIT_MAX);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 5;
}
export function allowReservation(key: string, now = Date.now()) {
  for (const [ip, entry] of requests)
    if (entry.expires <= now) requests.delete(ip);
  const entry = requests.get(key);
  if (entry) {
    if (entry.count >= maxAttempts()) return false;
    entry.count++;
  } else {
    if (requests.size >= 10000) return false;
    requests.set(key, { count: 1, expires: now + 15 * 60 * 1000 });
  }
  return true;
}

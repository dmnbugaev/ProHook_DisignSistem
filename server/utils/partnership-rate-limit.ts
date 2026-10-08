// Per-process protection. Use a shared limiter at the proxy for multiple replicas.
const requests = new Map<string, { count: number; expires: number }>();
export function allowPartnership(key: string, now = Date.now()) {
  for (const [ip, entry] of requests)
    if (entry.expires <= now) requests.delete(ip);
  const entry = requests.get(key);
  if (entry) {
    if (entry.count >= 5) return false;
    entry.count++;
  } else {
    if (requests.size >= 10000) return false;
    requests.set(key, { count: 1, expires: now + 15 * 60 * 1000 });
  }
  return true;
}

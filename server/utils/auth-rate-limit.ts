// Per-process protection (как partnership-rate-limit): для нескольких
// реплик нужен общий лимитер на прокси по проверенному адресу клиента.
//
// register — 5 попыток за 15 минут на IP;
// login    — 10 попыток за 15 минут на IP и на нормализованный телефон.
// Пороги можно переопределить для тестов (AUTH_RATE_LIMIT_REGISTER /
// AUTH_RATE_LIMIT_LOGIN), production использует значения по умолчанию.
const requests = new Map<string, { count: number; expires: number }>();

function envLimit(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const REGISTER_LIMIT = envLimit("AUTH_RATE_LIMIT_REGISTER", 5);
const LOGIN_LIMIT = envLimit("AUTH_RATE_LIMIT_LOGIN", 10);

function allow(key: string, limit: number, now: number): boolean {
  for (const [id, entry] of requests)
    if (entry.expires <= now) requests.delete(id);
  const entry = requests.get(key);
  if (entry) {
    if (entry.count >= limit) return false;
    entry.count++;
  } else {
    if (requests.size >= 10000) return false;
    requests.set(key, { count: 1, expires: now + 15 * 60 * 1000 });
  }
  return true;
}

export function allowRegister(key: string, now = Date.now()): boolean {
  return allow(`register:${key}`, REGISTER_LIMIT, now);
}

export function allowLogin(
  ip: string,
  phone: string,
  now = Date.now(),
): boolean {
  return (
    allow(`login-ip:${ip}`, LOGIN_LIMIT, now) &&
    allow(`login-phone:${phone}`, LOGIN_LIMIT, now)
  );
}

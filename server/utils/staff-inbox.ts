/**
 * Allowlist аккаунтов с доступом к инбоксу заявок (/api/staff/inbox).
 * Телефоны (нормализованные, только цифры) задаются в server-side окружении
 * переменной STAFF_INBOX_PHONES через запятую — клиентский бандл её не видит.
 */
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function staffInboxPhones(): string[] {
  return (process.env.STAFF_INBOX_PHONES ?? "")
    .split(",")
    .map((item) => normalizePhone(item.trim()))
    .filter(Boolean);
}

export function staffInboxAllowed(phone: string | undefined): boolean {
  if (!phone) return false;
  return staffInboxPhones().includes(normalizePhone(phone));
}

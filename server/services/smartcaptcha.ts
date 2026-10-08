/**
 * Yandex SmartCaptcha: серверная проверка токена виджета.
 * Серверный ключ (SMARTCAPTCHA_SERVER_KEY) — секрет, существует только
 * на сервере; клиент получает лишь публичный sitekey виджета.
 * Если серверный ключ не задан (локальная разработка, тесты), проверка
 * считается отключённой — в production ключ обязателен (docs/COMPLIANCE.md).
 */
const VERIFY_URL = "https://smartcaptcha.yandexcloud.net/validate";

export function isSmartCaptchaConfigured(): boolean {
  return Boolean(process.env.SMARTCAPTCHA_SERVER_KEY?.trim());
}

export async function verifySmartCaptcha(
  token: string,
  ip?: string,
  request: typeof fetch = fetch,
): Promise<boolean> {
  const secret = process.env.SMARTCAPTCHA_SERVER_KEY?.trim();
  if (!secret) return false;
  try {
    const response = await request(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, token, ...(ip ? { ip } : {}) }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const result = (await response.json().catch(() => null)) as {
      status?: string;
    } | null;
    return result?.status === "ok";
  } catch {
    // Таймаут или сетевая ошибка проверку не засчитывают.
    return false;
  }
}

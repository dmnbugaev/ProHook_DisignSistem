/**
 * Жёсткий рубильник отправок в Telegram для тестовых окружений (мандат
 * владельца 20.10.2026: во время тестов в боты не должно уходить ничего).
 *
 * Playwright передаёт серверу TELEGRAM_SILENT=1 (playwright.config.ts);
 * этого достаточно даже если dev-сервер подхватил реальные токены из .env.
 * Прод не выставляет переменную — доставка работает как обычно.
 */
export function telegramSilenced(): boolean {
  return process.env.TELEGRAM_SILENT === "1";
}

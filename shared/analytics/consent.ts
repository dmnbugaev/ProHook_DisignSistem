/**
 * Согласие на использование файлов cookie (152-ФЗ): схема решения и парсинг.
 *
 * Категории cookie сайта:
 * - необходимые (возрастной гейт 18+, выбранный магазин, список выбранных
 *   товаров, сессия личного кабинета, само решение о cookie) — работают
 *   без согласия, отключить нельзя, статистику не собирают;
 * - аналитические (Яндекс Метрика) — подключаются только после явного
 *   согласия через баннер; без согласия скрипт счётчика и noscript-пиксель
 *   не загружаются вовсе.
 *
 * Другие сервисы (карта Яндекс.Карт на «Контактах», Yandex SmartCaptcha в
 * форме запроса на резерв) обращаются к внешним серверам только по прямому
 * действию посетителя и собственных cookie на страницах сайта не ставят.
 */

export const CONSENT_COOKIE_NAME = "prohook-consent";
/** Решение о cookie переспрашивается раз в 180 дней. */
export const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;
/**
 * Версия схемы. Изменение состава категорий (добавление новых видов
 * аналитики) инкрементирует версию — старые решения считаются
 * недействительными, баннер показывается заново.
 */
export const CONSENT_VERSION = 1;

export interface ConsentState {
  v: number;
  /** Согласие на аналитические cookie (Яндекс Метрика). */
  analytics: boolean;
  /** Момент решения (мс UNIX epoch). */
  ts: number;
}

export function buildConsent(analytics: boolean): ConsentState {
  return { v: CONSENT_VERSION, analytics, ts: Date.now() };
}

/**
 * Разбирает значение cookie (строку из HTTP-заголовка или уже
 * десериализованный объект — useCookie возвращает объект). Всё, что не
 * соответствует текущей версии схемы, считается отсутствием решения:
 * баннер будет показан, аналитика — не подключится.
 */
export function parseConsent(raw: unknown): ConsentState | null {
  let value = raw;
  if (typeof raw === "string") {
    if (!raw) return null;
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (record.v !== CONSENT_VERSION || typeof record.analytics !== "boolean")
    return null;
  return {
    v: CONSENT_VERSION,
    analytics: record.analytics,
    ts:
      typeof record.ts === "number" && Number.isFinite(record.ts)
        ? record.ts
        : 0,
  };
}

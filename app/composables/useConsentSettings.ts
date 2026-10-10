/**
 * Согласие на использование файлов cookie: реактивное решение, доступное
 * баннеру (app/components/common/CookieConsent.vue), плагину Метрики и
 * футеру. Схема и константы — shared/analytics/consent.ts.
 *
 * Первое чтение состояния видит cookie в запросе (SSR), поэтому до
 * гидрации баннер не мигает: решение показывается сразу в нужном виде.
 */
import {
  CONSENT_COOKIE_MAX_AGE,
  CONSENT_COOKIE_NAME,
  buildConsent,
  parseConsent,
  type ConsentState,
} from "~~/shared/analytics/consent";

export function useConsentSettings() {
  const cookie = useCookie<ConsentState | null>(CONSENT_COOKIE_NAME, {
    maxAge: CONSENT_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  const decision = useState<ConsentState | null>(
    "cookie-consent-decision",
    () => parseConsent(cookie.value),
  );
  /** Решение не принято (или не соответствует текущей схеме) — показать баннер. */
  const needsDecision = computed(() => decision.value === null);
  const analyticsAllowed = computed(() => decision.value?.analytics === true);
  /** Повторное открытие баннера по кнопке «Файлы cookie» в футере. */
  const settingsOpen = useState("cookie-consent-settings", () => false);

  /**
   * Отзыв ранее данного согласия: удаляем установленные Метрикой
   * идентификаторы (_ym_*) и перезагружаем страницу — загруженный tag.js
   * не имеет документированного способа полной остановки, а после
   * перезагрузки плагин видит отказ и не подключает счётчик вовсе.
   */
  function purgeMetrikaCookies() {
    if (typeof document === "undefined") return;
    const names = document.cookie
      .split(";")
      .map((part) => part.split("=")[0]?.trim())
      .filter((name): name is string => !!name && name.startsWith("_ym_"));
    for (const name of names) {
      document.cookie = `${name}=; Max-Age=0; path=/`;
    }
  }

  function saveConsent(analytics: boolean) {
    const previous = decision.value;
    const state = buildConsent(analytics);
    cookie.value = state;
    decision.value = state;
    settingsOpen.value = false;
    if (previous?.analytics && !analytics) {
      purgeMetrikaCookies();
      window.location.reload();
    }
  }

  function openSettings() {
    settingsOpen.value = true;
  }

  return {
    decision,
    needsDecision,
    analyticsAllowed,
    settingsOpen,
    saveConsent,
    openSettings,
  };
}

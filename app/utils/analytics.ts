/**
 * Типобезопасная обёртка аналитики для компонентов. Инициализируется
 * плагином yandex-metrika.client.ts; до инициализации или при
 * отключённой Метрике вызовы — тихий no-op (в dev/test счётчик не
 * грузится, события не теряют код вызова).
 */
import {
  sanitizeEventParams,
  type AnalyticsEventName,
  type AnalyticsEventParams,
} from "~~/shared/analytics/metrika";

/**
 * Функция ym официального загрузчика: вызовы до загрузки tag.js
 * складываются в очередь ym.a (см. app/plugins/yandex-metrika.client.ts).
 */
export interface YmFunction {
  (...args: unknown[]): void;
  a?: unknown[][];
  l?: number;
}

declare global {
  interface Window {
    ym?: YmFunction;
  }
}

let counterId: string | null = null;

/** Вызывается один раз из плагина после успешной init Метрики. */
export function setAnalyticsCounter(id: string) {
  counterId = id;
}

/**
 * Отзыв согласия на аналитику: обёртка перестаёт отправлять события,
 * пока счётчик не будет инициализирован заново (после повторного
 * согласия плагин перезагружает страницу или заново вызывает init).
 */
export function resetAnalyticsCounter() {
  counterId = null;
}

export function analyticsEnabled() {
  return counterId !== null && typeof window !== "undefined" && !!window.ym;
}

/**
 * Отправка цели. Параметры фильтруются allowlist'ом
 * (ANALYTICS_EVENT_PARAMS): персональные данные пройти не могут.
 */
export function trackEvent(
  name: AnalyticsEventName,
  params?: AnalyticsEventParams,
) {
  if (!analyticsEnabled()) return;
  const clean = sanitizeEventParams(name, params);
  window.ym?.(Number(counterId), "reachGoal", name, clean);
}

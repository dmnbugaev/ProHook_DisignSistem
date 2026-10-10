/**
 * Яндекс.Метрика 113582832 — единая точка интеграции (только клиент).
 *
 * - подключается ТОЛЬКО с согласия на аналитические cookie
 *   (баннер согласия, cookie prohook-consent; 152-ФЗ): без решения
 *   счётчик не грузится и не отправляет ничего, при согласии в середине
 *   сеанса — подключается в момент клика; при отказе не грузится никогда;
 * - скрипт tag.js вставляется один раз (защита от повторной загрузки —
 *   и официальная проверка document.scripts, и флаг загрузки);
 * - первичный просмотр учитывается самой init; SPA-переходы Vue Router
 *   досылаются ym(..., "hit") с дедупликацией исходного URL — двойного
 *   учёта нет;
 * - ecommerce: "dataLayer" оставлен по конфигурации счётчика: сайт не
 *   формирует dataLayer и не отправляет ecommerce-событий (покупки
 *   происходят только офлайн в магазинах; см. SEO_COMPLIANCE_AUDIT.md
 *   §Ecommerce);
 * - конфигурация загрузки (auto/0/1) — resolveMetrika(); в dev и на
 *   localhost счётчик не грузится.
 */
import {
  METRIKA_COUNTER_ID,
  resolveMetrika,
} from "~~/shared/analytics/metrika";
import {
  setAnalyticsCounter,
  resetAnalyticsCounter,
} from "~~/app/utils/analytics";

export default defineNuxtPlugin((nuxtApp) => {
  const config = nuxtApp.$config.public;
  const enabled = resolveMetrika({
    setting: config.metrikaEnabled,
    prod: process.env.NODE_ENV === "production",
    hostname: window.location.hostname,
  });
  if (!enabled) return;

  const { analyticsAllowed } = useConsentSettings();
  const counterId = METRIKA_COUNTER_ID;
  const scriptSrc = `https://mc.yandex.ru/metrika/tag.js?id=${counterId}`;
  let loaded = false;

  function loadCounter() {
    if (loaded) return;
    loaded = true;

    // Официальный загрузчик (адаптирован): очередь ym.a работает ещё до
    // загрузки tag.js, повторная вставка скрипта исключена.
    (function (m: Window, e: Document, t: "script", r: string) {
      m.ym =
        m.ym ||
        function (...args: unknown[]) {
          m.ym!.a = m.ym!.a || [];
          m.ym!.a.push(args);
        };
      m.ym!.l = Date.now();
      for (const script of Array.from(e.scripts)) {
        if (script.src === r) return;
      }
      const k = e.createElement(t);
      const a = e.getElementsByTagName(t)[0];
      k.async = true;
      k.src = r;
      a?.parentNode?.insertBefore(k, a);
    })(window, document, "script", scriptSrc);

    const ym = (...args: unknown[]) => window.ym?.(...args);
    ym(Number(counterId), "init", {
      ssr: true,
      webvisor: true,
      clickmap: true,
      ecommerce: "dataLayer",
      referrer: document.referrer,
      url: location.href,
      accurateTrackBounce: true,
      trackLinks: true,
    });
    setAnalyticsCounter(counterId);

    // SPA-навигация: hit после смены маршрута. Исходный URL уже учтён
    // init выше — пропускаем его, дальше шлём hit c referer на предыдущий
    // внутренний адрес (рекомендация Метрики для SPA).
    let lastTracked = window.location.pathname + window.location.search;
    let previousUrl = lastTracked;
    nuxtApp.$router.afterEach(async () => {
      await nextTick();
      const url = window.location.pathname + window.location.search;
      if (url === lastTracked) return;
      const referer = previousUrl;
      previousUrl = url;
      lastTracked = url;
      ym(Number(counterId), "hit", url, { title: document.title, referer });
    });
  }

  if (analyticsAllowed.value) {
    loadCounter();
    return;
  }

  // Согласие ещё не получено: ждём решения баннера (при отказе счётчик
  // не подключается; при отзыве — обёртка перестаёт отправлять события,
  // а composable дополнительно перезагружает страницу).
  watch(analyticsAllowed, (allowed) => {
    if (allowed) loadCounter();
    else resetAnalyticsCounter();
  });
});

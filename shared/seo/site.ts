/**
 * Единый источник SEO-параметров сайта, общий для клиента и сервера
 * (canonical, sitemap, robots.txt, JSON-LD).
 *
 * Домен кириллический (прохук.рф): во всех машинных представлениях
 * (canonical, sitemap, robots.txt) используем punycode-форму
 * xn--j1ahceql.xn--p1ai — WHATWG URL сериализует хост в ASCII
 * автоматически. Одна каноническая форма домена исключает дубли
 * между кириллической и punycode-записью.
 */

export const SITE_URL = "https://прохук.рф";

/** punycode-форма основного домена (для robots.txt/Sitemap). */
export const SITE_HOST_PUNYCODE = "xn--j1ahceql.xn--p1ai";

/**
 * Индексируемые страницы сайта — только информационные и юридические
 * разделы. Каталог, категории, карточки товаров, поиск и служебные
 * страницы в sitemap не входят: содержимое каталога скрывается до
 * подтверждения 18+, а витрина регулируемой продукции с ценами несёт
 * риск квалификации как реклама (38-ФЗ ст. 7; docs/COMPLIANCE.md §9.1,
 * SEO_COMPLIANCE_AUDIT.md). Изменение списка — только после
 * юридической оценки.
 */
export const INDEXABLE_ROUTES: readonly string[] = [
  "/",
  "/about",
  "/stores",
  "/contacts",
  "/information",
  "/partners",
  "/privacy",
  "/personal-data",
];

/**
 * Абсолютный URL в канонической (punycode) форме для метаданных и
 * sitemap. Путь принимается только внутренний и ASCII (латинские slug
 * маршрутов проекта), поисковые/query-часть отсекаются — canonical
 * всегда указывает на чистый путь.
 */
export function canonicalSiteUrl(path: string, baseUrl: string = SITE_URL) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const withoutQuery = (normalized.split("?")[0] ?? normalized).split("#")[0];
  return new URL(withoutQuery ?? normalized, baseUrl).href;
}

/** Домен в punycode по произвольному базовому URL (для sitemap/robots). */
export function punycodeHost(baseUrl: string = SITE_URL) {
  return new URL(baseUrl).hostname;
}

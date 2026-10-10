/**
 * Sitemap.xml — только индексируемые информационные страницы
 * (INDEXABLE_ROUTES). Каталог, категории и карточки товаров в sitemap
 * не входят: контент каталога скрыт до подтверждения 18+, а включение
 * витрины регулируемой продукции в карту сайта до юридической оценки
 * несёт риск квалификации как реклама (38-ФЗ ст. 7; подробнее —
 * SEO_COMPLIANCE_AUDIT.md). lastmod не указывается: даты изменения
 * статических страниц не фиксируются в учётной системе, фиктивные
 * даты протокол запрещает.
 */
import { INDEXABLE_ROUTES, canonicalSiteUrl } from "~~/shared/seo/site";

export default defineEventHandler((event) => {
  const siteUrl = useRuntimeConfig(event).public.siteUrl || "https://прохук.рф";
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const route of INDEXABLE_ROUTES) {
    const url = canonicalSiteUrl(route, siteUrl);
    if (seen.has(url)) continue; // защита от дублей
    seen.add(url);
    urls.push(`  <url>\n    <loc>${url}</loc>\n  </url>`);
  }
  setResponseHeader(event, "Content-Type", "application/xml; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=3600");
  setResponseHeader(event, "X-Robots-Tag", "noindex");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
});

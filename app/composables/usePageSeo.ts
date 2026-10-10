import { canonicalSiteUrl } from "~~/shared/seo/site";
import { breadcrumbSchema, type BreadcrumbItem } from "~~/shared/seo/schema";

export interface PageSeoOptions {
  /**
   * true — страница входит в индексируемый информационный контур
   * (см. INDEXABLE_ROUTES): robots index,follow + canonical + og:url.
   * По умолчанию noindex,follow — безопасный дефолт для каталога,
   * личных и служебных страниц.
   */
  index?: boolean;
  /** Хлебные крошки страницы (для BreadcrumbList JSON-LD). */
  breadcrumbs?: BreadcrumbItem[];
}

export function usePageSeo(
  title: MaybeRefOrGetter<string>,
  description: MaybeRefOrGetter<string>,
  image: MaybeRefOrGetter<string> = "/brand/lockup.webp",
  options: PageSeoOptions = {},
) {
  const siteUrl = useRuntimeConfig().public.siteUrl || "https://прохук.рф";
  const route = useRoute();
  const pageTitle = () => `${toValue(title)} — Прохук`;

  useSeoMeta({
    title: pageTitle,
    description: () => toValue(description),
    robots: options.index ? "index, follow" : "noindex, follow",
    ogTitle: pageTitle,
    ogDescription: () => toValue(description),
    ogImage: () => toValue(image),
    ogType: "website",
    ogLocale: "ru_RU",
    ...(options.index
      ? {
          ogUrl: () => canonicalSiteUrl(route.path, siteUrl),
        }
      : {}),
  });

  if (options.index) {
    // Канонический абсолютный URL в punycode-форме домена; query-часть
    // отсекается — варианты с параметрами схлопываются в один адрес.
    useHead({
      link: [
        () => ({
          rel: "canonical",
          href: canonicalSiteUrl(route.path, siteUrl),
        }),
      ],
    });
    if (options.breadcrumbs?.length) {
      useHead({
        script: [
          {
            type: "application/ld+json",
            innerHTML: JSON.stringify(
              breadcrumbSchema(options.breadcrumbs, siteUrl),
            ),
          },
        ],
      });
    }
  }
}

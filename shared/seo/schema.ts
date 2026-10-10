/**
 * Структурированные данные Schema.org (JSON-LD).
 *
 * Юридические ограничения (docs/COMPLIANCE.md, SEO_COMPLIANCE_AUDIT.md):
 * - Product/Offer/AggregateRating/Review для регулируемой продукции
 *   НЕ создаются — merchant-разметка витрины несёт риск квалификации
 *   как реклама (38-ФЗ ст. 7) и стимулирование дистанционной продажи
 *   (15-ФЗ ст. 19);
 * - используются только проверяемые факты: реквизиты продавца,
 *   телефоны, адреса и часы работы физических магазинов;
 * - фиктивные рейтинги, отзывы и предложения не добавляются.
 */
import { canonicalSiteUrl } from "./site";

interface Contacts {
  phone: string;
  phoneHref: string;
  email: string;
  vk: string;
  telegram: string;
  instagram: string;
}

interface StoreLike {
  id: string;
  cityId: string;
  name: string;
  address: string;
  district?: string;
  hours?: string;
  coordinates?: [number, number];
}

const cityName = (cityId: string) =>
  cityId === "saratov"
    ? "Саратов"
    : cityId === "engels"
      ? "Энгельс"
      : cityId === "moscow"
        ? "Москва"
        : cityId;

/**
 * «Ежедневно, 9:00–22:00» → «Mo-Su 9:00-22:00». Возвращает null, если
 * формат не распознан однозначно: недостоверные часы не публикуем.
 */
export function parseOpeningHours(hours: string | undefined): string | null {
  if (!hours) return null;
  const match =
    /ежедневно[^0-9]*(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})/i.exec(hours);
  if (!match) return null;
  return `Mo-Su ${match[1]}-${match[2]}`;
}

export function organizationSchema(contacts: Contacts, baseUrl?: string) {
  const url = canonicalSiteUrl("/", baseUrl);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${url}#organization`,
    name: "Прохук",
    description:
      "Сеть розничных магазинов. Сайт — справочный каталог; продажа осуществляется только в магазинах после проверки совершеннолетия.",
    url,
    logo: canonicalSiteUrl("/brand/mark.webp", baseUrl),
    email: contacts.email,
    telephone: contacts.phone,
    sameAs: [contacts.vk, contacts.telegram, contacts.instagram],
    contactPoint: {
      "@type": "ContactPoint",
      telephone: contacts.phone,
      contactType: "customer service",
      availableLanguage: ["Russian"],
    },
  };
}

export function websiteSchema(baseUrl?: string) {
  const url = canonicalSiteUrl("/", baseUrl);
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${url}#website`,
    name: "Прохук",
    inLanguage: "ru-RU",
    url,
    publisher: { "@id": `${url}#organization` },
  };
}

/**
 * Список физических точек сети как LocalBusiness/Store. Публикация
 * адресов и часов работы магазинов — правомерная информация о местах
 * продажи (запрет 38-ФЗ ст. 7 касается рекламы, а не справочных
 * сведений о точках продаж).
 */
export function storeSchemas(
  stores: readonly StoreLike[],
  contacts: Contacts,
  baseUrl?: string,
) {
  const pageUrl = canonicalSiteUrl("/stores", baseUrl);
  return stores.map((store) => {
    const node: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Store",
      "@id": `${pageUrl}#${store.id}`,
      name: `Прохук — ${store.name}`,
      address: {
        "@type": "PostalAddress",
        streetAddress: store.address,
        addressLocality: cityName(store.cityId),
        addressCountry: "RU",
      },
      telephone: contacts.phone,
      url: pageUrl,
      parentOrganization: canonicalSiteUrl("/", baseUrl) + "#organization",
    };
    const openingHours = parseOpeningHours(store.hours);
    if (openingHours) node.openingHours = openingHours;
    if (store.coordinates) {
      node.geo = {
        "@type": "GeoCoordinates",
        latitude: store.coordinates[1],
        longitude: store.coordinates[0],
      };
    }
    return node;
  });
}

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function breadcrumbSchema(
  items: readonly BreadcrumbItem[],
  baseUrl?: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.to ? { item: canonicalSiteUrl(item.to, baseUrl) } : {}),
    })),
  };
}

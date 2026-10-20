import type {
  CatalogMeta,
  CatalogQuery,
  ProductList,
} from "../../shared/types/catalog";
import type { Product } from "../../shared/types/product";
import { enforceRegionalRestrictions } from "../../shared/legal/catalog-policy";
import { getOffer } from "../../shared/utils/product";
import {
  compileSearchDocument,
  matchSearchQuery,
  tokenizeSearchQuery,
  type CompiledSearchDocument,
} from "../../shared/utils/search";
import { storeLocations } from "../../shared/content/stores";
import { getCatalogSnapshot } from "../services/catalog-cache";

export interface CatalogRepository {
  getMeta(): Promise<CatalogMeta>;
  getProduct(slug: string): Promise<Product | undefined>;
  getProductById(id: string): Promise<Product | undefined>;
  list(query: CatalogQuery, options?: ListOptions): Promise<ProductList>;
  suggest(
    query: CatalogQuery,
    limit?: number,
    options?: ListOptions,
  ): Promise<SuggestItem[]>;
}

/**
 * Ограничение выборки общедоступным ассортиментом: сервер применяет его,
 * когда запрос пришёл без подтверждения 18+ (см. utils/age-gate.ts).
 */
export interface ListOptions {
  agePublicOnly?: boolean;
}

export interface SuggestItem {
  id: string;
  slug: string;
  name: string;
  categoryName: string;
  /** Цена в копейках для выбранного магазина или минимальная по сети. */
  price: number | null;
}

/** Нормализация адреса для сопоставления учётных и публичных справочников. */
function normalizeAddress(address: string): string {
  const head = address.split("—")[0] ?? address;
  return head
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9/\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const coordinatesByAddress = new Map(
  storeLocations
    .filter((location) => location.coordinates)
    .map((location) => [
      normalizeAddress(location.address),
      location.coordinates!,
    ]),
);
const publicAddresses = [...coordinatesByAddress.keys()];

/**
 * Координаты для учётного адреса магазина: сначала точное совпадение с
 * публичным справочником, затем вхождение по границе слова (учётный адрес
 * может нести префикс посёлка/района: «Боброво, ул. Крымская, 1 — …»).
 */
function coordinatesFor(address: string): [number, number] | undefined {
  const normalized = normalizeAddress(address);
  if (!normalized) return undefined;
  const exact = coordinatesByAddress.get(normalized);
  if (exact) return exact;
  const embedded = publicAddresses.find(
    (candidate) =>
      normalized.startsWith(`${candidate} `) ||
      normalized.endsWith(` ${candidate}`),
  );
  return embedded ? coordinatesByAddress.get(embedded) : undefined;
}

/** Дистанция между точками в км (гаверсинус) — для автоподбора магазина. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Кэш поисковых документов: компиляция один раз на объект товара; после
 * обновления снимка объекты пересоздаются и кэш перестраивается сам.
 */
const searchDocuments = new WeakMap<Product, CompiledSearchDocument>();

function searchDocument(product: Product): CompiledSearchDocument {
  let compiled = searchDocuments.get(product);
  if (!compiled) {
    compiled = compileSearchDocument(product);
    searchDocuments.set(product, compiled);
  }
  return compiled;
}

export const catalogRepository: CatalogRepository = {
  async getMeta() {
    const meta = (await getCatalogSnapshot()).meta;
    // Координаты для геолокации подтягиваются из публичного справочника
    // точек по совпадению адреса; снимок МойСклада остаётся нетронутым.
    return {
      ...meta,
      stores: meta.stores.map((store) => {
        if (!store.address) return store;
        const coordinates = coordinatesFor(store.address);
        return coordinates ? { ...store, coordinates } : store;
      }),
    };
  },
  async getProduct(slug) {
    const { meta, products } = await getCatalogSnapshot();
    // Региональные запреты продажи исключают офферы магазинов региона
    // (например, запрет ЭСДН в Саратовской области с 01.03.2027).
    return enforceRegionalRestrictions(products, meta.stores).find(
      (product) => product.slug === slug,
    );
  },
  async getProductById(id) {
    const { meta, products } = await getCatalogSnapshot();
    return enforceRegionalRestrictions(products, meta.stores).find(
      (product) => product.id === id,
    );
  },
  async list(query, options) {
    const { meta: catalogMeta, products } = await getCatalogSnapshot();
    if (
      query.storeId &&
      !catalogMeta.stores.some((store) => store.id === query.storeId)
    )
      throw createError({ statusCode: 400, statusMessage: "Unknown store" });
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    )
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid price range",
      });
    const category = catalogMeta.categories.find(
      (item) => item.slug === query.category,
    );
    if (query.category && !category)
      throw createError({
        statusCode: 404,
        statusMessage: "Category not found",
      });
    const categoryIds = new Set(category ? [category.id] : []);
    for (let previous = -1; previous !== categoryIds.size;) {
      previous = categoryIds.size;
      for (const child of catalogMeta.categories)
        if (child.parentId && categoryIds.has(child.parentId))
          categoryIds.add(child.id);
    }
    const price = (product: Product) =>
      query.storeId
        ? (getOffer(product, query.storeId)?.price ?? Infinity)
        : Math.min(...product.offers.map((offer) => offer.price));
    const available = (product: Product) =>
      (query.storeId
        ? product.offers.filter((offer) => offer.storeId === query.storeId)
        : product.offers
      ).some(
        (offer) =>
          offer.availability === "plenty" ||
          offer.availability === "available" ||
          offer.availability === "low",
      );
    const words = tokenizeSearchQuery(query.q);
    let visible = enforceRegionalRestrictions(products, catalogMeta.stores);
    // Без подтверждения 18+ выдача ограничена общедоступным ассортиментом;
    // totals/pageCount считаются по той же выборке, что и items.
    if (options?.agePublicOnly)
      visible = visible.filter((item) => item.agePublic);
    // Выборка по ids (список выбранных товаров): другие фильтры не нужны,
    // отсутствующие id молча пропускаются — список чистится на клиенте.
    if (query.ids) {
      const byId = new Map(visible.map((product) => [product.id, product]));
      const items = query.ids
        .map((id) => byId.get(id))
        .filter((product): product is Product => Boolean(product));
      return { items, total: items.length, page: 1, pageCount: 1 };
    }
    // Релевантность поиска (умный матчинг с опечатками/раскладкой/транслитом):
    // без запроса скор не нужен, сортировки пользователя не переопределяются.
    const scored = new Map<Product, number>();
    const filtered = visible.filter((product) => {
      if (!(
        (!category || categoryIds.has(product.categoryId)) &&
        (!query.storeId ||
          product.offers.some((offer) => offer.storeId === query.storeId)) &&
        (query.minPrice === undefined ||
          price(product) >= query.minPrice * 100) &&
        (query.maxPrice === undefined ||
          price(product) <= query.maxPrice * 100) &&
        (!query.available || available(product)) &&
        product.id !== query.excludeId
      ))
        return false;
      if (!words.length) return true;
      const score = matchSearchQuery(words, searchDocument(product));
      if (score === null) return false;
      scored.set(product, score);
      return true;
    });
    // Витринный приоритет для сортировки по умолчанию: вперёд выходят товары
    // с фотографией и достаточным наличием (2+ шт: "available"/"plenty",
    // не "low") в выбранном магазине — или в любом, если магазин не выбран.
    const stockRank = (product: Product) => {
      const offers = query.storeId
        ? product.offers.filter((offer) => offer.storeId === query.storeId)
        : product.offers;
      const plenty = offers.some(
        (offer) =>
          offer.availability === "plenty" || offer.availability === "available",
      );
      const hasPhoto = product.images.length > 0;
      if (hasPhoto && plenty) return 0;
      if (hasPhoto) return 1;
      if (plenty) return 2;
      return 3;
    };
    filtered.sort((a, b) => {
      if (query.sort === "price-asc")
        return price(a) - price(b) || a.id.localeCompare(b.id);
      if (query.sort === "price-desc")
        return price(b) - price(a) || a.id.localeCompare(b.id);
      if (query.sort === "newest")
        return b.publishedAt.localeCompare(a.publishedAt);
      // Сортировка по умолчанию в поиске — по релевантности, затем витринный
      // приоритет (фото + наличие) и свежесть. В каталоге без запроса скор
      // отсутствует и порядок не меняется.
      const relevance =
        words.length && !query.sort
          ? (scored.get(b) ?? 0) - (scored.get(a) ?? 0)
          : 0;
      return (
        relevance ||
        stockRank(a) - stockRank(b) ||
        b.publishedAt.localeCompare(a.publishedAt) ||
        a.name.localeCompare(b.name, "ru")
      );
    });
    const pageCount = Math.ceil(filtered.length / query.limit);
    const page = Math.min(query.page, Math.max(1, pageCount));
    return {
      items: filtered.slice((page - 1) * query.limit, page * query.limit),
      total: filtered.length,
      page,
      pageCount,
    };
  },
  async suggest(query, limit = 8, options) {
    const { meta: catalogMeta, products } = await getCatalogSnapshot();
    if (query.storeId) {
      if (!catalogMeta.stores.some((store) => store.id === query.storeId))
        throw createError({ statusCode: 400, statusMessage: "Unknown store" });
    }
    const words = tokenizeSearchQuery(query.q);
    if (!words.length) return [];
    const stockRank = (product: Product) => {
      const offers = query.storeId
        ? product.offers.filter((offer) => offer.storeId === query.storeId)
        : product.offers;
      const plenty = offers.some(
        (offer) =>
          offer.availability === "plenty" || offer.availability === "available",
      );
      return product.images.length && plenty
        ? 0
        : product.images.length
          ? 1
          : 2;
    };
    let visible = enforceRegionalRestrictions(products, catalogMeta.stores);
    if (options?.agePublicOnly)
      visible = visible.filter((item) => item.agePublic);
    return visible
      .map((product) => ({
        product,
        // Умный матчинг: опечатки, раскладка, транслит; null — не подошло.
        score: matchSearchQuery(words, searchDocument(product)),
        price: ((): number | null => {
          const offer = query.storeId
            ? getOffer(product, query.storeId)
            : undefined;
          return (
            offer?.price ??
            (product.offers.length
              ? Math.min(...product.offers.map((item) => item.price))
              : null)
          );
        })(),
      }))
      .filter(
        (item): item is typeof item & { score: number } => item.score !== null,
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          stockRank(a.product) - stockRank(b.product) ||
          b.product.publishedAt.localeCompare(a.product.publishedAt),
      )
      .slice(0, limit)
      .map(({ product, price }) => ({
        id: product.id,
        slug: product.slug,
        name: product.name,
        categoryName: product.categoryName ?? "Каталог",
        price,
      }));
  },
};

import type {
  CatalogMeta,
  CatalogQuery,
  ProductList,
} from "../../shared/types/catalog";
import type { Product } from "../../shared/types/product";
import { enforceRegionalRestrictions } from "../../shared/legal/catalog-policy";
import { getOffer } from "../../shared/utils/product";
import { storeLocations } from "../../shared/content/stores";
import { getCatalogSnapshot } from "../services/catalog-cache";

export interface CatalogRepository {
  getMeta(): Promise<CatalogMeta>;
  getProduct(slug: string): Promise<Product | undefined>;
  getProductById(id: string): Promise<Product | undefined>;
  list(query: CatalogQuery): Promise<ProductList>;
  suggest(query: CatalogQuery, limit?: number): Promise<SuggestItem[]>;
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
  async list(query) {
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
          offer.availability === "available" || offer.availability === "low",
      );
    const words = query.q.toLocaleLowerCase("ru").split(/\s+/).filter(Boolean);
    const visible = enforceRegionalRestrictions(products, catalogMeta.stores);
    // Выборка по ids (список выбранных товаров): другие фильтры не нужны,
    // отсутствующие id молча пропускаются — список чистится на клиенте.
    if (query.ids) {
      const byId = new Map(visible.map((product) => [product.id, product]));
      const items = query.ids
        .map((id) => byId.get(id))
        .filter((product): product is Product => Boolean(product));
      return { items, total: items.length, page: 1, pageCount: 1 };
    }
    const filtered = visible.filter((product) => {
      const haystack =
        `${product.name} ${product.categoryName ?? ""} ${product.sku}`.toLocaleLowerCase(
          "ru",
        );
      return (
        (!category || categoryIds.has(product.categoryId)) &&
        (!query.storeId ||
          product.offers.some((offer) => offer.storeId === query.storeId)) &&
        words.every((word) => haystack.includes(word)) &&
        (query.minPrice === undefined ||
          price(product) >= query.minPrice * 100) &&
        (query.maxPrice === undefined ||
          price(product) <= query.maxPrice * 100) &&
        (!query.available || available(product)) &&
        (!query.photo || product.images.length > 0) &&
        product.id !== query.excludeId
      );
    });
    // Витринный приоритет для сортировки по умолчанию: вперёд выходят товары
    // с фотографией и достаточным наличием (availability "available", не
    // "low") в выбранном магазине — или в любом, если магазин не выбран.
    const stockRank = (product: Product) => {
      const offers = query.storeId
        ? product.offers.filter((offer) => offer.storeId === query.storeId)
        : product.offers;
      const plenty = offers.some((offer) => offer.availability === "available");
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
      return (
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
  async suggest(query, limit = 8) {
    const { meta: catalogMeta, products } = await getCatalogSnapshot();
    if (query.storeId) {
      if (!catalogMeta.stores.some((store) => store.id === query.storeId))
        throw createError({ statusCode: 400, statusMessage: "Unknown store" });
    }
    const words = query.q.toLocaleLowerCase("ru").split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const stockRank = (product: Product) => {
      const offers = query.storeId
        ? product.offers.filter((offer) => offer.storeId === query.storeId)
        : product.offers;
      const plenty = offers.some((offer) => offer.availability === "available");
      return product.images.length && plenty
        ? 0
        : product.images.length
          ? 1
          : 2;
    };
    return enforceRegionalRestrictions(products, catalogMeta.stores)
      .filter((product) => {
        const haystack =
          `${product.name} ${product.categoryName ?? ""} ${product.sku}`.toLocaleLowerCase(
            "ru",
          );
        return words.every((word) => haystack.includes(word));
      })
      .map((product) => {
        const name = product.name.toLocaleLowerCase("ru");
        const offer = query.storeId
          ? getOffer(product, query.storeId)
          : undefined;
        const price =
          offer?.price ??
          (product.offers.length
            ? Math.min(...product.offers.map((item) => item.price))
            : null);
        return {
          product,
          score: words.every((word) => name.startsWith(word)) ? 0 : 1,
          price,
        };
      })
      .sort(
        (a, b) =>
          a.score - b.score ||
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

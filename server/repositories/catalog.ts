import type {
  CatalogMeta,
  CatalogQuery,
  ProductList,
} from "../../shared/types/catalog";
import type { Product } from "../../shared/types/product";
import { getOffer } from "../../shared/utils/product";
import { getCatalogSnapshot } from "../services/catalog-cache";

export interface CatalogRepository {
  getMeta(): Promise<CatalogMeta>;
  getProduct(slug: string): Promise<Product | undefined>;
  list(query: CatalogQuery): Promise<ProductList>;
}

export const catalogRepository: CatalogRepository = {
  async getMeta() {
    return (await getCatalogSnapshot()).meta;
  },
  async getProduct(slug) {
    return (await getCatalogSnapshot()).products.find(
      (product) => product.slug === slug,
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
    const filtered = products.filter((product) => {
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
        product.id !== query.excludeId
      );
    });
    filtered.sort((a, b) => {
      if (query.sort === "price-asc")
        return price(a) - price(b) || a.id.localeCompare(b.id);
      if (query.sort === "price-desc")
        return price(b) - price(a) || a.id.localeCompare(b.id);
      if (query.sort === "newest")
        return b.publishedAt.localeCompare(a.publishedAt);
      return (
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
};

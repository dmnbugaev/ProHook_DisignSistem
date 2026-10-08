import { parseCatalogQuery } from "../../../../shared/utils/catalog-query";
import { catalogRepository } from "../../../repositories/catalog";

export interface AdjacentProduct {
  slug: string;
  name: string;
}

/**
 * Соседние товары категории для навигации «Предыдущий / Следующий» на
 * карточке товара. Порядок — тот же, что в выдаче каталога по умолчанию,
 * чтобы стрелки вели по списку, который пользователь видел в категории.
 */
export default defineEventHandler(async (event) => {
  const product = await catalogRepository.getProduct(
    getRouterParam(event, "slug") || "",
  );
  if (!product)
    throw createError({ statusCode: 404, statusMessage: "Product not found" });
  const list = await catalogRepository.list({
    ...parseCatalogQuery({}),
    category: product.categoryId,
    limit: 100000,
  });
  const index = list.items.findIndex((item) => item.id === product.id);
  if (index < 0) return { prev: null, next: null };
  const pick = (item?: (typeof list.items)[number]): AdjacentProduct | null =>
    item ? { slug: item.slug, name: item.name } : null;
  return {
    prev: pick(list.items[index - 1]),
    next: pick(list.items[index + 1]),
  };
});

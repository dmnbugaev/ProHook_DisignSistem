import type { CatalogMeta, ProductList } from "~~/shared/types/catalog";
import type { Product } from "~~/shared/types/product";
export function useCatalogMeta() {
  return useFetch<CatalogMeta>("/api/catalog/meta", { key: "catalog-meta" });
}
export function useProducts(
  query: MaybeRefOrGetter<
    Record<string, string | string[] | number | undefined>
  >,
) {
  return useFetch<ProductList>("/api/products", {
    query: computed(() => toValue(query)),
  });
}
export function useProduct(slug: MaybeRefOrGetter<string>) {
  return useFetch<Product>(
    () => `/api/products/${encodeURIComponent(toValue(slug))}`,
  );
}

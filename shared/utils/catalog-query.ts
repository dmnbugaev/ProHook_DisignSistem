import type { CatalogQuery, CatalogSort } from "../types/catalog";
export function parseCatalogQuery(
  input: Record<string, unknown>,
): CatalogQuery {
  const text = (key: string) => {
    const value = input[key];
    return typeof value === "string" ? value.slice(0, 200) : "";
  };
  const price = (key: string) => {
    const raw = text(key);
    const value = Number(raw);
    return raw && Number.isFinite(value) && value >= 0
      ? Math.min(value, 10000000)
      : undefined;
  };
  const sort = text("sort");
  const sorts: CatalogSort[] = ["popular", "price-asc", "price-desc", "newest"];
  return {
    q: text("q").trim(),
    category: text("category"),
    minPrice: price("minPrice"),
    maxPrice: price("maxPrice"),
    available: text("available") === "1",
    storeId: text("storeId"),
    sort: sorts.includes(sort as CatalogSort)
      ? (sort as CatalogSort)
      : "popular",
    page: Math.min(10000, Math.max(1, Math.floor(Number(text("page")) || 1))),
    limit: Math.min(24, Math.max(1, Math.floor(Number(text("limit")) || 12))),
    excludeId: text("excludeId"),
  };
}

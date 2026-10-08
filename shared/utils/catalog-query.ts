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
  // ids читается без 200-символьного среза text(): до 24 UUID не влезают.
  const ids = typeof input.ids === "string" ? input.ids : "";
  const idList = ids
    .split(",")
    .map((item) => item.trim())
    .filter((item) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(item))
    .slice(0, 24);
  return {
    q: text("q").trim(),
    category: text("category"),
    minPrice: price("minPrice"),
    maxPrice: price("maxPrice"),
    available: text("available") === "1",
    photo: text("photo") === "1",
    storeId: text("storeId"),
    sort: sorts.includes(sort as CatalogSort)
      ? (sort as CatalogSort)
      : "popular",
    page: Math.min(10000, Math.max(1, Math.floor(Number(text("page")) || 1))),
    limit: Math.min(24, Math.max(1, Math.floor(Number(text("limit")) || 12))),
    excludeId: text("excludeId"),
    ...(idList.length > 0 ? { ids: idList } : {}),
  };
}

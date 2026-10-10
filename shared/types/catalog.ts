import type { Brand } from "./brand";
import type { Category } from "./category";
import type { City, Store } from "./store";
import type { Product } from "./product";
export type CatalogSort = "popular" | "price-asc" | "price-desc" | "newest";
export interface CatalogQuery {
  q: string;
  category: string;
  minPrice?: number;
  maxPrice?: number;
  available: boolean;
  storeId: string;
  sort: CatalogSort;
  page: number;
  limit: number;
  excludeId: string;
  /** Выборка конкретных товаров по id (список выбранных, /reserve). */
  ids?: string[];
}
export interface ProductList {
  items: Product[];
  total: number;
  page: number;
  pageCount: number;
}
export interface CatalogMeta {
  categories: Category[];
  brands: Brand[];
  stores: Store[];
  cities: City[];
  materials: string[];
}

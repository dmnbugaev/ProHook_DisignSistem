import type { CatalogMeta } from "../types/catalog";
import type { Category } from "../types/category";
import type { Product } from "../types/product";
import {
  LEGAL_CLASS_POLICIES,
  classifyRootCategory,
  type LegalClass,
} from "./classification";
import {
  activeRestrictionFor,
  type RegionalRestriction,
} from "./regional-restrictions";

interface PolicyInput {
  meta: CatalogMeta;
  products: Array<Omit<Product, "legalClass"> & { legalClass?: LegalClass }>;
}

/** Снимок после применения политики: каждый товар имеет legalClass. */
export interface PolicySnapshot {
  meta: CatalogMeta;
  products: Product[];
}

/** Возвращает юридический класс товара по цепочке категорий до корня. */
export function legalClassOf(
  categoryId: string,
  categoriesById: Map<string, Category>,
): LegalClass {
  let current = categoriesById.get(categoryId);
  const visited = new Set<string>();
  let rootName: string | undefined = current?.name;
  while (current?.parentId && !visited.has(current.parentId)) {
    visited.add(current.id);
    current = categoriesById.get(current.parentId);
    if (current) rootName = current.name;
  }
  return classifyRootCategory(rootName);
}

/**
 * Применяет юридическую политику к снимку каталога: исключает товары и
 * категории классов PENDING_REVIEW/BANNED_FROM_SITE, назначает товарам
 * legalClass и убирает свободные описания у регулируемых классов.
 * Идемпотентно: повторное применение ничего не меняет.
 */
export function applyLegalPolicy<T extends PolicyInput>(
  snapshot: T,
): T & PolicySnapshot {
  const categoriesById = new Map(
    snapshot.meta.categories.map((item) => [item.id, item]),
  );
  const classByCategory = new Map<string, LegalClass>();
  for (const category of snapshot.meta.categories)
    classByCategory.set(category.id, legalClassOf(category.id, categoriesById));

  const categories = snapshot.meta.categories.filter(
    (item) =>
      LEGAL_CLASS_POLICIES[classByCategory.get(item.id)!].publishCategories,
  );
  const products = snapshot.products
    .map((product) => {
      const legalClass =
        classByCategory.get(product.categoryId) ?? "PENDING_REVIEW";
      const policy = LEGAL_CLASS_POLICIES[legalClass];
      return {
        ...product,
        legalClass,
        description: policy.publishDescription ? product.description : "",
      };
    })
    .filter(
      (product) => LEGAL_CLASS_POLICIES[product.legalClass].publishProducts,
    );

  return { ...snapshot, meta: { ...snapshot.meta, categories }, products };
}

export interface RegionRestrictedOffer {
  storeId: string;
  restriction: RegionalRestriction;
}

/**
 * Убирает офферы магазинов, в регионе которых действует запрет на класс
 * товара, и исключает товары, оставшиеся без офферов. Дата проверяется
 * в момент вызова — ограничение включается автоматически.
 */
export function enforceRegionalRestrictions(
  products: Product[],
  stores: CatalogMeta["stores"],
  now: Date = new Date(),
): Product[] {
  const restrictions = new Map<string, RegionalRestriction>();
  for (const store of stores) {
    const restriction = activeRestrictionFor(store.cityId, now);
    if (restriction) restrictions.set(store.id, restriction);
  }
  if (restrictions.size === 0) return products;
  return products
    .map((product) => {
      if (!product.legalClass) return product;
      const bannedStores = new Set(
        [...restrictions.entries()]
          .filter(([, restriction]) =>
            restriction.bannedClasses.includes(product.legalClass!),
          )
          .map(([storeId]) => storeId),
      );
      if (bannedStores.size === 0) return product;
      return {
        ...product,
        offers: product.offers.filter(
          (offer) => !bannedStores.has(offer.storeId),
        ),
      };
    })
    .filter((product) => product.offers.length > 0);
}

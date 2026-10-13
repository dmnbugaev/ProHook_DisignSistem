import type { CatalogMeta } from "../../shared/types/catalog";
import type { Product } from "../../shared/types/product";

/**
 * Серверное скрытие изображений для пользователей без подтверждённого
 * совершеннолетия (не вошёл или младше 18). Общедоступные товары
 * (agePublic: напитки, снеки, лапша, чай, ароматизаторы, глицерин —
 * решение владельца 13.10.2026) изображения сохраняют: их витрина не
 * ограничена по возрасту. Срез выполняется на уровне API каталога, а сам
 * прокси изображений дополнительно проверяет доступ — прямой URL
 * регулируемого товара без взрослой сессии возвращает 403.
 */
export function restrictProductImages<T extends Product>(product: T): T {
  if (product.agePublic) return product;
  return { ...product, images: [], imagesRestricted: true };
}

export function restrictProductListImages<T extends { items: Product[] }>(
  list: T,
): T {
  return { ...list, items: list.items.map(restrictProductImages) };
}

/** Обложки категорий ссылаются на те же изображения товаров. */
export function restrictMetaImages(meta: CatalogMeta): CatalogMeta {
  return {
    ...meta,
    categories: meta.categories.map((category) => ({
      ...category,
      // undefined выпадает из JSON-ответа, а UI проверяет на truthy.
      image: category.agePublic ? category.image : undefined,
    })),
  };
}

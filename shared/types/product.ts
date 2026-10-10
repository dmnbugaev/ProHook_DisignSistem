import type { Brand } from "./brand";
import type { LegalClass } from "../legal/classification";
import type { StoreOffer } from "./store";
export interface ProductImage {
  id: string;
  src: string;
  alt: string;
}
export interface ProductAttribute {
  code: string;
  name: string;
  value: string;
}
export interface Product {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brand?: Brand;
  categoryName?: string;
  categoryId: string;
  images: ProductImage[];
  description: string;
  /**
   * Фасовка позиции для покупателя: «10 г» (китайский чай) или «1 шт».
   * Заполняется на сервере по корневой категории МойСклад.
   */
  unit?: string;
  attributes: ProductAttribute[];
  offers: StoreOffer[];
  /** Юридический класс (см. shared/legal/classification.ts). */
  legalClass: LegalClass;
  publishedAt: string;
  /**
   * true, когда изображения скрыты сервером: пользователь не вошёл
   * или младше 18 лет. В этом случае images приходит пустым.
   */
  imagesRestricted?: boolean;
}

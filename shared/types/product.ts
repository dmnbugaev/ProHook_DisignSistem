import type { Brand } from "./brand";
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
  attributes: ProductAttribute[];
  offers: StoreOffer[];
  isPopular: boolean;
  isNew: boolean;
  publishedAt: string;
}

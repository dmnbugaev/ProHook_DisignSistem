import type { Product } from "../types/product";
export const availabilityLabels = {
  available: "В наличии",
  low: "Мало в наличии",
  /** Нулевой остаток: ассортимент пополняется, поэтому оптимистичная метка. */
  unavailable: "Скоро в наличии",
  unknown: "Наличие уточняется",
} as const;
const currencyFormat = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});
export const formatPrice = (minorUnits: number) =>
  currencyFormat.format(minorUnits / 100);
export const getOffer = (product: Product, storeId: string) =>
  product.offers.find((offer) => offer.storeId === storeId);

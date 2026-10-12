import type { Product } from "../types/product";
export const availabilityLabels = {
  plenty: "Много в наличии",
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
// МойСклад прикладывает совместимость к описанию отдельным абзацем
// «Совместимость: …» (после пустой строки). Отделяем её, чтобы страница
// товара показывала совместимость отдельным блоком с новой строки.
const COMPATIBILITY_MARKER = /(?:^|\n)[ \t]*Совместимость[ \t]*:[ \t]*/;
export const splitProductDescription = (description: string) => {
  const match = description.match(COMPATIBILITY_MARKER);
  if (!match || match.index === undefined)
    return { main: description.trim(), compatibility: null };
  const compatibility = description.slice(match.index + match[0].length).trim();
  return {
    main: description.slice(0, match.index).trim(),
    compatibility: compatibility || null,
  };
};

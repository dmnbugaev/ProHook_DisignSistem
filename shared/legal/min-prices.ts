import type { Product } from "../types/product";

/**
 * Проверка минимальных розничных цен (МРЦ) на никотинсодержащую продукцию.
 * МРЦ действуют с 01.09.2024 и рассчитываются по формулам от ставок акцизов,
 * поэтому периодически индексируются.
 *
 * ВАЖНО: значения ниже не подставлены автоматически. Владельцу/бухгалтеру
 * необходимо сверить действующие пороги с актуальной редакцией
 * постановления Правительства РФ о порядке определения МРЦ и внести их
 * сюда (в рублях за 1 мл). Ноль = проверка отключена — цены при этом
 * НЕ изменяются и товары НЕ скрываются: валидатор только предупреждает
 * в журнале синхронизации (npm run catalog:sync).
 */
export interface MinPriceConfig {
  /** Жидкость во флаконе, ₽/мл. */
  bottlePerMl: number;
  /** Жидкость в картридже/капсуле, ₽/мл. */
  cartridgePerMl: number;
  /** Жидкость в составе одноразового устройства, ₽/мл. */
  disposablePerMl: number;
}

export const MIN_PRICE_CONFIG: MinPriceConfig = {
  bottlePerMl: 0,
  cartridgePerMl: 0,
  disposablePerMl: 0,
};

export function minPricesConfigured(config: MinPriceConfig = MIN_PRICE_CONFIG) {
  return (
    config.bottlePerMl > 0 ||
    config.cartridgePerMl > 0 ||
    config.disposablePerMl > 0
  );
}

/** Объём в мл из названия товара («10 мл», «30мл»), либо null. */
// Паучи (REGULATED_POUCH) не содержат «мл» в названиях и автоматически
// пропускаются; применимость и пороги МРЦ для паучей — уточнить владельцу
// при заполнении конфигурации.
export function extractVolumeMl(name: string): number | null {
  const match = name.match(/(\d+(?:[.,]\d+)?)\s*мл/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1]!.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

type Packaging = "disposable" | "cartridge" | "bottle";

function packagingOf(product: Product): Packaging | null {
  if (/\bоднораз/i.test(product.name) || /puffs|затяж/i.test(product.name))
    return "disposable";
  if (/картридж|капсул/i.test(product.name)) return "cartridge";
  return "bottle";
}

export interface BelowMinimum {
  sku: string;
  name: string;
  volumeMl: number;
  pricePerMl: number;
  thresholdPerMl: number;
}

/**
 * Возвращает товары класса REGULATED_NICOTINE, чья цена (минимальная по
 * магазинам, в пересчёте на мл) ниже настроенного порога МРЦ. Цена в офферах
 * хранится в копейках.
 */
export function findBelowMinimum(
  products: Product[],
  config: MinPriceConfig = MIN_PRICE_CONFIG,
): BelowMinimum[] {
  if (!minPricesConfigured(config)) return [];
  const result: BelowMinimum[] = [];
  for (const product of products) {
    if (product.legalClass !== "REGULATED_NICOTINE") continue;
    const volumeMl = extractVolumeMl(product.name);
    if (!volumeMl || product.offers.length === 0) continue;
    const threshold =
      packagingOf(product) === "disposable"
        ? config.disposablePerMl
        : packagingOf(product) === "cartridge"
          ? config.cartridgePerMl
          : config.bottlePerMl;
    if (threshold <= 0) continue;
    const minPrice = Math.min(...product.offers.map((offer) => offer.price));
    const pricePerMl = minPrice / 100 / volumeMl;
    if (pricePerMl < threshold)
      result.push({
        sku: product.sku,
        name: product.name,
        volumeMl,
        pricePerMl,
        thresholdPerMl: threshold,
      });
  }
  return result;
}

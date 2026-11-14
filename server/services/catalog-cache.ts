import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import type { Product } from "../../shared/types/product";
import { applyLegalPolicy } from "../../shared/legal/catalog-policy";
import { fetchCatalog, fetchStock, type CatalogSnapshot } from "./moysklad";
import { applyFirstPublished } from "./first-published";

const FIXTURE_FILE = process.env.MOYSKLAD_SNAPSHOT_PATH;
const CACHE_FILE = resolve(
  process.cwd(),
  FIXTURE_FILE || ".cache/moysklad/catalog.json",
);
const TTL = 5 * 60 * 1000;
let snapshot: CatalogSnapshot | undefined;
let loaded = false;
let catalogRefresh: Promise<CatalogSnapshot> | undefined;
let stockRefresh: Promise<void> | undefined;

async function save(value: CatalogSnapshot) {
  await mkdir(dirname(CACHE_FILE), { recursive: true, mode: 0o700 });
  await chmod(dirname(CACHE_FILE), 0o700);
  const temp = `${CACHE_FILE}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value), { mode: 0o600 });
  await rename(temp, CACHE_FILE);
}

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const value = JSON.parse(
      await readFile(CACHE_FILE, "utf8"),
    ) as CatalogSnapshot;
    if (Array.isArray(value.products) && value.meta?.stores)
      // Снимок мог быть записан до смены юридической политики — применяем её
      // повторно (идемпотентно: фильтрация запрещённых классов, legalClass).
      snapshot = applyLegalPolicy(value);
  } catch {
    // The first run has no private snapshot yet.
  }
}

function retainStock(next: CatalogSnapshot, previous?: CatalogSnapshot) {
  if (!previous?.stockUpdatedAt) return next;
  const old = new Map(
    previous.products.map((product) => [product.id, product]),
  );
  next.products = next.products.map((product) => {
    const prior = old.get(product.id);
    if (!prior) return product;
    const availability = new Map(
      prior.offers.map((offer) => [offer.storeId, offer.availability]),
    );
    return {
      ...product,
      offers: product.offers.map((offer) => ({
        ...offer,
        availability: availability.get(offer.storeId) ?? "unknown",
      })),
    } as Product;
  });
  // Точные остатки переживают обновление каталога, пока не придёт новый
  // отчёт остатков (stockDetail — server-only, API его не отдаёт).
  next.stockDetail = previous.stockDetail;
  next.stockUpdatedAt = previous.stockUpdatedAt;
  return next;
}

export async function refreshCatalog() {
  if (catalogRefresh) return catalogRefresh;
  catalogRefresh = trackRefreshResult(async () => {
    await load();
    // Порядок важен: retainStock переносит доступность из прошлого снимка,
    // applyFirstPublished — даты первой публикации (новинки не зависят от
    // правок в МойСклад, см. first-published.ts).
    const next = applyFirstPublished(
      retainStock(await fetchCatalog(), snapshot),
      snapshot,
    );
    snapshot = next;
    await save(next);
    return next;
  });
  try {
    return await catalogRefresh;
  } finally {
    catalogRefresh = undefined;
  }
}

export async function refreshStock() {
  if (stockRefresh) return stockRefresh;
  stockRefresh = trackRefreshResult(async () => {
    const current = await getCatalogSnapshot();
    const { products, stockDetail } = await fetchStock(current);
    // A newer catalog refresh may have completed during the stock report.
    if (snapshot === current) {
      snapshot = {
        ...current,
        products,
        stockDetail,
        stockUpdatedAt: Date.now(),
      };
      await save(snapshot);
    }
  });
  try {
    await stockRefresh;
  } finally {
    stockRefresh = undefined;
  }
}

function background(task: Promise<unknown>) {
  void task.catch((error: unknown) => {
    console.error(
      "MoySklad catalog refresh failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
  });
}

/**
 * Шторм-защита (диагностика 14.11.2026): код 1061 от МойСклад — в том
 * числе анти-абуз-блокировка за поток неудачных запросов. Пока рефреш
 * падает, снимок остаётся «просроченным» (updatedAt не двигается), и
 * ленивый TTL-рефреш порождал новую попытку на КАЖДЫЙ запрос
 * посетителя — до 854 попыток в час на проде, три дня подряд. Этот
 * поток сам удерживал блокировку. Пауза после сбоев растёт
 * экспоненциально и сбрасывается первым успехом.
 */
export const REFRESH_BACKOFF_CAP_MS = 60 * 60 * 1000;

/** Пауза перед следующей попыткой рефреша после N сбоев подряд. */
export function refreshBackoffMs(consecutiveFailures: number): number {
  const safe = Math.max(1, Math.floor(consecutiveFailures));
  return Math.min(TTL * 2 ** (safe - 1), REFRESH_BACKOFF_CAP_MS);
}

let refreshFailures = 0;
let refreshBlockedUntil = 0;

/** Идёт ли пауза после сбоев — таймеры плагина и ленивый путь ждут. */
export function refreshPaused(now: number = Date.now()): boolean {
  return now < refreshBlockedUntil;
}

async function trackRefreshResult<T>(task: () => Promise<T>): Promise<T> {
  try {
    const result = await task();
    refreshFailures = 0;
    refreshBlockedUntil = 0;
    return result;
  } catch (error) {
    refreshFailures += 1;
    refreshBlockedUntil = Date.now() + refreshBackoffMs(refreshFailures);
    throw error;
  }
}

export async function getCatalogSnapshot(): Promise<CatalogSnapshot> {
  await load();
  if (FIXTURE_FILE) {
    if (!snapshot) throw new Error("MoySklad test snapshot is missing");
    return snapshot;
  }
  if (!snapshot) await refreshCatalog();
  const current = snapshot!;
  // Во время паузы после сбоев не порождаем рефреши на каждый запрос.
  if (!refreshPaused()) {
    if (Date.now() - current.updatedAt >= TTL)
      background(refreshCatalog().then(() => refreshStock()));
    else if (Date.now() - current.stockUpdatedAt >= TTL)
      background(refreshStock());
  }
  return current;
}

export async function syncCatalogNow() {
  // Явная команда оператора — паузу сбрасываем.
  refreshBlockedUntil = 0;
  await refreshCatalog();
  await refreshStock();
  return snapshot!;
}

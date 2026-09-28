import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import type { Product } from "../../shared/types/product";
import {
  excludeHiddenStores,
  fetchCatalog,
  fetchStock,
  type CatalogSnapshot,
} from "./moysklad";

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
      snapshot = excludeHiddenStores(value);
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
  next.stockUpdatedAt = previous.stockUpdatedAt;
  return next;
}

export async function refreshCatalog() {
  if (catalogRefresh) return catalogRefresh;
  catalogRefresh = (async () => {
    await load();
    const next = retainStock(await fetchCatalog(), snapshot);
    snapshot = next;
    await save(next);
    return next;
  })();
  try {
    return await catalogRefresh;
  } finally {
    catalogRefresh = undefined;
  }
}

export async function refreshStock() {
  if (stockRefresh) return stockRefresh;
  stockRefresh = (async () => {
    const current = await getCatalogSnapshot();
    const products = await fetchStock(current);
    // A newer catalog refresh may have completed during the stock report.
    if (snapshot === current) {
      snapshot = { ...current, products, stockUpdatedAt: Date.now() };
      await save(snapshot);
    }
  })();
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

export async function getCatalogSnapshot(): Promise<CatalogSnapshot> {
  await load();
  if (FIXTURE_FILE) {
    if (!snapshot) throw new Error("MoySklad test snapshot is missing");
    return snapshot;
  }
  if (!snapshot) await refreshCatalog();
  const current = snapshot!;
  if (Date.now() - current.updatedAt >= TTL)
    background(refreshCatalog().then(() => refreshStock()));
  else if (Date.now() - current.stockUpdatedAt >= TTL)
    background(refreshStock());
  return current;
}

export async function syncCatalogNow() {
  await refreshCatalog();
  await refreshStock();
  return snapshot!;
}

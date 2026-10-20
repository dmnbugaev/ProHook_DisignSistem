import { refreshCatalog, refreshStock } from "../services/catalog-cache";

/**
 * Проактивное обновление каталога МойСклад по таймеру.
 *
 * Ленивый TTL-рефреш (getCatalogSnapshot) обновляет данные только при
 * трафике; таймер гарантирует, что новые товары, цены и фотографии из
 * МойСклад появляются на сайте сами (максимальная задержка — интервал
 * ниже), без переобработки и без нового билда.
 *
 * Отключён в e2e-режиме (MOYSKLAD_SNAPSHOT_PATH) и без токена МойСклад —
 * там работает только ленивая загрузка фикстуры.
 */

const FIXTURE_MODE = Boolean(process.env.MOYSKLAD_SNAPSHOT_PATH);
const HAS_TOKEN = Boolean(
  process.env.NUXT_MOYSKLAD_TOKEN || process.env.MOYSKLAD_TOKEN,
);

function interval(env: string, fallbackMs: number): number {
  const raw = Number.parseInt(process.env[env] ?? "", 10);
  return Number.isFinite(raw) && raw >= 60_000 ? raw : fallbackMs;
}

const STOCK_INTERVAL = interval("CATALOG_STOCK_REFRESH_MS", 5 * 60 * 1000);
const CATALOG_INTERVAL = interval("CATALOG_REFRESH_MS", 30 * 60 * 1000);

function schedule(ms: number, task: () => Promise<unknown>, label: string) {
  const timer = setInterval(() => {
    void task().catch((error: unknown) => {
      console.error(
        `Catalog refresh (${label}) failed:`,
        error instanceof Error ? error.message : "Unknown error",
      );
    });
  }, ms);
  // Таймер не должен держать процесс живым (dev-сервер, graceful shutdown).
  timer.unref?.();
}

export default defineNitroPlugin(() => {
  if (FIXTURE_MODE || !HAS_TOKEN) return;
  schedule(STOCK_INTERVAL, refreshStock, "stock");
  // Полный цикл каталога завершается отчётом остатков — как в ленивом пути.
  schedule(
    CATALOG_INTERVAL,
    () => refreshCatalog().then(() => refreshStock()),
    "catalog",
  );
});

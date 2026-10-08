import { readFile } from "node:fs/promises";
import process from "node:process";
import { URL } from "node:url";
import { createJiti } from "jiti";

try {
  const source = await readFile(new URL("../.env", import.meta.url), "utf8");
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z_0-9]*)=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
} catch {
  // Production can provide the token through its environment.
}

const jiti = createJiti(import.meta.url);
const { syncCatalogNow } = await jiti.import(
  "../server/services/catalog-cache.ts",
);
const { findBelowMinimum, minPricesConfigured, MIN_PRICE_CONFIG } =
  await jiti.import("../shared/legal/min-prices.ts");
const snapshot = await syncCatalogNow();
process.stdout.write(
  `МойСклад: ${snapshot.products.length} товаров, ${snapshot.meta.categories.length} категорий, ${snapshot.meta.stores.length} магазинов.\n`,
);
// Проверка МРЦ: только предупреждения, цены не изменяются автоматически.
if (minPricesConfigured(MIN_PRICE_CONFIG)) {
  const below = findBelowMinimum(snapshot.products, MIN_PRICE_CONFIG);
  if (below.length) {
    process.stdout.write(
      `ВНИМАНИЕ: ${below.length} товаров REGULATED_NICOTINE ниже настроенного порога МРЦ (проверьте цены и законность продажи):\n`,
    );
    for (const item of below)
      process.stdout.write(
        `  - ${item.sku} · ${item.name}: ${item.pricePerMl.toFixed(2)} ₽/мл при пороге ${item.thresholdPerMl} ₽/мл\n`,
      );
  }
} else {
  process.stdout.write(
    "Проверка МРЦ отключена: пороги не заданы в shared/legal/min-prices.ts (сверить с действующей редакцией постановления и внести).\n",
  );
}

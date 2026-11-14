import { test } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { refreshBackoffMs, REFRESH_BACKOFF_CAP_MS } = await jiti.import(
  "../server/services/catalog-cache.ts",
);

// Регрессия 14.11.2026: при сбоях МойСклад (403/1061) ленивый TTL-рефреш
// порождал новую попытку на каждый запрос посетителя — до 854 попыток в
// час на проде, и этот поток неудач сам удерживал анти-абуз-блокировку
// 1061. Пауза после сбоев обязана расти экспоненциально от TTL и
// упираться в потолок, сбрасываясь первым успехом (см. catalog-cache.ts).

test("пауза рефреша растёт от TTL экспоненциально до потолка", () => {
  assert.equal(refreshBackoffMs(1), 300_000); // 5 мин — первый сбой
  assert.equal(refreshBackoffMs(2), 600_000); // 10 мин
  assert.equal(refreshBackoffMs(3), 1_200_000); // 20 мин
  assert.equal(refreshBackoffMs(4), 2_400_000); // 40 мин
  assert.equal(refreshBackoffMs(5), 3_600_000); // упёрлись в потолок 60 мин
  assert.equal(refreshBackoffMs(6), REFRESH_BACKOFF_CAP_MS);
  assert.equal(refreshBackoffMs(100), REFRESH_BACKOFF_CAP_MS);
});

test("некорректные входы зажимаются до первого шага", () => {
  assert.equal(refreshBackoffMs(0), 300_000);
  assert.equal(refreshBackoffMs(-3), 300_000);
  assert.equal(refreshBackoffMs(1.7), 300_000);
});

test("потолок — час: даже длинный сбой не замораживает каталог навсегда", () => {
  assert.equal(REFRESH_BACKOFF_CAP_MS, 60 * 60 * 1000);
});

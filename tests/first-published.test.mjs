import assert from "node:assert/strict";
import { test } from "node:test";
import { createJiti } from "jiti";

const { applyFirstPublished } = await createJiti(import.meta.url).import(
  "../server/services/first-published.ts",
);

// CatalogSnapshot достаточной формы: applyFirstPublished трогает только
// products и firstPublished.
const snapshot = (products) => ({ products, meta: { stores: [] } });
const product = (id, publishedAt) => ({
  id,
  name: `Товар ${id}`,
  publishedAt,
});

test("холодный старт: всем существующим товарам — один штамп, реестр заполнен", () => {
  const next = applyFirstPublished(
    snapshot([product("a", "2026-10-20T14:53:39Z"), product("b", "")]),
  );
  const stamps = next.products.map((item) => item.firstPublishedAt);
  assert.equal(new Set(stamps).size, 1);
  // Штамп — текущий момент: на холодном старте вся существующая витрина
  // считается «старым ассортиментом», а не новинками с датами правок.
  assert.ok(!Number.isNaN(Date.parse(stamps[0])));
  assert.deepEqual(Object.keys(next.firstPublished).sort(), ["a", "b"]);
});

test("правка товара не меняет дату первой публикации", () => {
  // Реестр задан вручную с заведомо старой датой — исключает совпадение
  // миллисекунд реальных часов между вызовами applyFirstPublished.
  const previous = {
    products: [],
    meta: { stores: [] },
    firstPublished: { a: "2026-10-01T00:00:00.000Z" },
  };
  // Товар отредактирован в МойСклад: publishedAt (updated) обновился,
  // а дата первой публикации осталась прежней.
  const edited = applyFirstPublished(
    snapshot([product("a", "2026-11-05T23:41:05Z")]),
    previous,
  );
  assert.equal(edited.products[0].firstPublishedAt, "2026-10-01T00:00:00.000Z");
  assert.equal(edited.products[0].publishedAt, "2026-11-05T23:41:05Z");
});

test("новый товар получает свежий штамп, старые сохраняют свои", () => {
  const previous = {
    products: [],
    meta: { stores: [] },
    firstPublished: { a: "2026-10-01T00:00:00.000Z" },
  };
  const next = applyFirstPublished(
    snapshot([product("a", "old"), product("new", "2026-11-11T10:00:00Z")]),
    previous,
  );
  const old = next.products.find((item) => item.id === "a");
  const fresh = next.products.find((item) => item.id === "new");
  assert.equal(old.firstPublishedAt, "2026-10-01T00:00:00.000Z");
  // Свежий штамп позже штампа существовавшего товара — это и есть инвариант
  // «новинок»: новый товар обгоняет старый независимо от даты прогона.
  assert.ok(
    Date.parse(fresh.firstPublishedAt) > Date.parse(old.firstPublishedAt),
  );
  assert.deepEqual(Object.keys(next.firstPublished).sort(), ["a", "new"]);
});

test("временно скрытый товар при возврате не становится новинкой второй раз", () => {
  const first = applyFirstPublished(snapshot([product("a", "old")]));
  const stamp = first.products[0].firstPublishedAt;
  // Товар скрыли («Показать на сайте» = нет) — в снимке его нет.
  const without = applyFirstPublished(snapshot([product("b", "x")]), first);
  assert.deepEqual(Object.keys(without.firstPublished).sort(), ["a", "b"]);
  // Товар вернулся — дата первой публикации сохранена.
  const returned = applyFirstPublished(
    snapshot([product("a", "old"), product("b", "x")]),
    without,
  );
  assert.equal(
    returned.products.find((item) => item.id === "a").firstPublishedAt,
    stamp,
  );
});

test("реестр не мутирует предыдущий снимок", () => {
  const previous = applyFirstPublished(snapshot([product("a", "old")]));
  const before = JSON.parse(JSON.stringify(previous.firstPublished));
  applyFirstPublished(
    snapshot([product("a", "old"), product("b", "x")]),
    previous,
  );
  assert.deepEqual(previous.firstPublished, before);
});

test("новинки-сортировка: правка старого не обгоняет по-настоящему новый", () => {
  const previous = {
    products: [],
    meta: { stores: [] },
    firstPublished: { old: "2026-11-01T00:00:00.000Z" },
  };
  const next = applyFirstPublished(
    snapshot([
      product("old", "2026-11-11T23:00:00Z"),
      product("new", "2026-11-01T00:00:00Z"),
    ]),
    previous,
  );
  // «old» отредактирован сегодня (publishedAt свежее), но опубликован
  // раньше: в «Новинках» первым стоит «new».
  const sorted = [...next.products].sort(
    (a, b) =>
      (b.firstPublishedAt ?? "").localeCompare(a.firstPublishedAt ?? "") ||
      a.name.localeCompare(b.name, "ru"),
  );
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["new", "old"],
  );
});

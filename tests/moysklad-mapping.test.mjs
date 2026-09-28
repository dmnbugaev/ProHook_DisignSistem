import assert from "node:assert/strict";
import { after, test } from "node:test";
import process from "node:process";
import { URL } from "node:url";
import { createJiti } from "jiti";

process.env.NUXT_MOYSKLAD_TOKEN = "test-token";
const { excludeHiddenStores, fetchCatalog, fetchStock } = await createJiti(
  import.meta.url,
).import("../server/services/moysklad.ts");
const originalFetch = globalThis.fetch;
const Response = globalThis.Response;
after(() => {
  globalThis.fetch = originalFetch;
});

const collection = (rows) => ({ meta: { size: rows.length }, rows });
const folder = { id: "folder-1", name: "Категория" };
const reference = {
  meta: {
    href: "https://api.moysklad.ru/api/remap/1.2/entity/productfolder/folder-1",
  },
};
const price = (name, value) => ({ priceType: { name }, value });
const products = [
  {
    id: "product-1",
    name: "Публичный",
    archived: false,
    productFolder: reference,
    salePrices: [price("Цена продажи", 120000), price("Москва", 140000)],
    attributes: [{ id: "visible-field", value: true }],
  },
  {
    id: "product-2",
    name: "Скрытый",
    archived: false,
    productFolder: reference,
    salePrices: [price("Цена продажи", 90000), price("Москва", 0)],
    attributes: [{ id: "visible-field", value: false }],
  },
  {
    id: "product-3",
    name: "Без цены",
    archived: false,
    productFolder: reference,
    salePrices: [price("Цена продажи", 0), price("Москва", 0)],
    attributes: [{ id: "visible-field", value: true }],
  },
];
let hasVisibilityField = true;
globalThis.fetch = async (input) => {
  const path = new URL(String(input)).pathname;
  const rows = path.endsWith("/entity/store")
    ? [
        { id: "store-1", name: "Садовая 1", pathName: "Саратов" },
        {
          id: "store-2",
          name: "МСК. Боброво - Крымская, 1",
          pathName: "Москва",
        },
        { id: "hidden-1", name: "Вокзал", pathName: "Саратов" },
        { id: "hidden-2", name: "Буровая", pathName: "Москва" },
        { id: "hidden-3", name: "Ильинская площадь", pathName: "Москва" },
        { id: "hidden-4", name: "Чапаева 45", pathName: "Саратов" },
        { id: "internal", name: "РЦ Саратов", pathName: "Саратов" },
      ]
    : path.endsWith("/entity/productfolder")
      ? [folder]
      : path.endsWith("/entity/product")
        ? products
        : path.endsWith("/entity/product/metadata/attributes")
          ? hasVisibilityField
            ? [
                {
                  id: "visible-field",
                  name: "Показать на сайте",
                  type: "boolean",
                },
              ]
            : []
          : path.endsWith("/report/stock/bystore")
            ? [
                {
                  meta: {
                    href: "https://api.moysklad.ru/api/remap/1.2/entity/product/product-1",
                  },
                  stockByStore: [
                    { name: "Садовая 1", stock: 4, reserve: 2 },
                    {
                      name: "МСК. Боброво - Крымская, 1",
                      stock: 1,
                      reserve: 1,
                    },
                  ],
                },
              ]
            : [];
  return new Response(JSON.stringify(collection(rows)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

test("visibility field, city prices and retail store mapping", async () => {
  const snapshot = await fetchCatalog();
  assert.equal(snapshot.products.length, 1);
  assert.equal(snapshot.meta.stores.length, 2);
  assert.equal(
    snapshot.meta.stores.find(
      (item) => item.name === "МСК. Боброво - Крымская, 1",
    )?.cityId,
    "moscow",
  );
  assert.equal(
    snapshot.meta.stores.some((item) => item.name === "Вокзал"),
    false,
  );
  assert.equal(
    snapshot.meta.stores.some((item) => item.name === "Буровая"),
    false,
  );
  assert.equal(
    snapshot.meta.stores.some((item) => item.name === "Ильинская площадь"),
    false,
  );
  assert.equal(
    snapshot.meta.stores.some((item) => item.name === "Чапаева 45"),
    false,
  );
  assert.deepEqual(
    snapshot.products[0].offers.map((offer) => offer.price),
    [140000, 120000],
  );
  const stocked = await fetchStock(snapshot);
  assert.equal(
    stocked[0].offers.find((offer) => offer.storeId === "store-1")
      ?.availability,
    "low",
  );
  assert.equal(
    stocked[0].offers.find((offer) => offer.storeId === "store-2")
      ?.availability,
    "unavailable",
  );
});

test("closed stores are removed from older cached snapshots and product offers", async () => {
  const snapshot = await fetchCatalog();
  snapshot.meta.stores.push({
    id: "closed-store",
    cityId: "saratov",
    name: "Чапаева 45",
    description: "Закрытая точка",
  });
  snapshot.products[0].offers.push({
    storeId: "closed-store",
    currency: "RUB",
    price: 100000,
    availability: "available",
  });

  const filtered = excludeHiddenStores(snapshot);
  assert.equal(
    filtered.meta.stores.some((store) => store.id === "closed-store"),
    false,
  );
  assert.equal(
    filtered.products[0].offers.some(
      (offer) => offer.storeId === "closed-store",
    ),
    false,
  );
  assert.equal(
    snapshot.meta.stores.some((store) => store.id === "closed-store"),
    true,
  );
});

test("without the visibility field, all priced active products are included", async () => {
  hasVisibilityField = false;
  const snapshot = await fetchCatalog();
  assert.deepEqual(snapshot.products.map((product) => product.name).sort(), [
    "Публичный",
    "Скрытый",
  ]);
  assert.equal(
    snapshot.products.find((product) => product.name === "Скрытый")?.offers
      .length,
    1,
  );
});

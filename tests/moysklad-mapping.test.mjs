import assert from "node:assert/strict";
import { after, test } from "node:test";
import process from "node:process";
import { URL } from "node:url";
import { createJiti } from "jiti";

process.env.NUXT_MOYSKLAD_TOKEN = "test-token";
const { fetchCatalog, fetchStock } = await createJiti(import.meta.url).import(
  "../server/services/moysklad.ts",
);
const originalFetch = globalThis.fetch;
const Response = globalThis.Response;
after(() => {
  globalThis.fetch = originalFetch;
});

const collection = (rows) => ({ meta: { size: rows.length }, rows });
const folder = { id: "folder-1", name: "Снеки" };
const chewFolder = { id: "folder-chew", name: "Жевательный табак" };
const liquidFolder = { id: "folder-liq", name: "Жидкости" };
const nbcFolder = { id: "folder-nbc", name: "НБС" };
const reference = {
  meta: {
    href: "https://api.moysklad.ru/api/remap/1.2/entity/productfolder/folder-1",
  },
};
const chewReference = {
  meta: {
    href: "https://api.moysklad.ru/api/remap/1.2/entity/productfolder/folder-chew",
  },
};
const liquidReference = {
  meta: {
    href: "https://api.moysklad.ru/api/remap/1.2/entity/productfolder/folder-liq",
  },
};
const nbcReference = {
  meta: {
    href: "https://api.moysklad.ru/api/remap/1.2/entity/productfolder/folder-nbc",
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
    attributes: [
      { id: "visible-field", value: true },
      { id: "site-name-field", value: "  Полное название публичного товара  " },
    ],
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
  {
    id: "product-4",
    name: "Паучи тестовые 4 мг",
    archived: false,
    description: "Вкус мятный.",
    productFolder: chewReference,
    salePrices: [price("Цена продажи", 70000)],
    attributes: [{ id: "visible-field", value: true }],
  },
  {
    id: "product-5",
    name: "Жидкость Тестовая 10 мл",
    archived: false,
    description: "В первом вдохе — вкус.",
    productFolder: liquidReference,
    salePrices: [price("Цена продажи", 150000)],
    attributes: [{ id: "visible-field", value: true }],
  },
  {
    id: "product-6",
    name: "НБС тестовый",
    archived: false,
    productFolder: nbcReference,
    salePrices: [price("Цена продажи", 30000)],
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
        { id: "hidden-2", name: "Буровая", pathName: "Саратов" },
        { id: "hidden-3", name: "Ильинская площадь", pathName: "Саратов" },
        { id: "hidden-4", name: "Чапаева 45", pathName: "Саратов" },
        { id: "internal", name: "РЦ Саратов", pathName: "Саратов" },
      ]
    : path.endsWith("/entity/productfolder")
      ? [folder, chewFolder, liquidFolder, nbcFolder]
      : path.endsWith("/entity/product")
        ? products
        : path.endsWith("/entity/product/metadata/attributes")
          ? [
              ...(hasVisibilityField
                ? [
                    {
                      id: "visible-field",
                      name: "Показать на сайте",
                      type: "boolean",
                    },
                  ]
                : []),
              {
                id: "site-name-field",
                name: "Название для сайта",
                type: "string",
              },
            ]
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

test("visibility field, city prices, retail store mapping and legal policy", async () => {
  const snapshot = await fetchCatalog();
  assert.deepEqual(snapshot.products.map((product) => product.name).sort(), [
    "Жидкость Тестовая 10 мл",
    "Паучи тестовые 4 мг",
    "Полное название публичного товара",
  ]);
  assert.equal(snapshot.products[0].name, "Полное название публичного товара");
  assert.equal(
    snapshot.products[0].attributes.some(
      (attribute) => attribute.code === "site-name-field",
    ),
    false,
  );
  assert.equal(snapshot.products[0].legalClass, "UNREGULATED");
  const liquid = snapshot.products.find(
    (product) => product.id === "product-5",
  );
  assert.equal(liquid.legalClass, "REGULATED_NICOTINE");
  // Описания публикуются для всех классов по решению владельца от
  // 10.10.2026 (тексты готовятся в МойСклад самим продавцом).
  assert.equal(liquid.description, "В первом вдохе — вкус.");
  const pouch = snapshot.products.find((product) => product.id === "product-4");
  // Паучи — регулируемая никотинсодержащая продукция (без табака).
  assert.equal(pouch.legalClass, "REGULATED_POUCH");
  const categoryNames = snapshot.meta.categories.map((item) => item.name);
  assert.ok(categoryNames.includes("Жевательный табак"));
  // Категория со скрытой публикацией не публикуется вместе с товарами.
  assert.ok(!categoryNames.includes("НБС"));
  assert.ok(!snapshot.products.some((product) => product.id === "product-6"));
  assert.equal(snapshot.meta.stores.length, 6);
  assert.equal(
    snapshot.meta.stores.find(
      (item) => item.name === "МСК. Боброво - Крымская, 1",
    )?.cityId,
    "moscow",
  );
  assert.equal(
    snapshot.meta.stores.some((item) => item.name === "Вокзал"),
    true,
  );
  assert.equal(
    snapshot.meta.stores.some((item) => item.name === "Буровая"),
    true,
  );
  assert.equal(
    snapshot.meta.stores.some((item) => item.name === "Ильинская площадь"),
    true,
  );
  assert.equal(
    snapshot.meta.stores.some((item) => item.name === "Чапаева 45"),
    true,
  );
  assert.deepEqual(
    snapshot.products[0].offers.map((offer) => offer.price),
    [140000, 120000, 120000, 120000, 120000, 120000],
  );
  const stocked = await fetchStock(snapshot);
  assert.equal(
    stocked.products[0].offers.find((offer) => offer.storeId === "store-1")
      ?.availability,
    "low",
  );
  assert.equal(
    stocked.products[0].offers.find((offer) => offer.storeId === "store-2")
      ?.availability,
    "unavailable",
  );
  // Точные остатки для запросов на резерв: server-only, в API не публикуются.
  assert.equal(stocked.stockDetail["product-1"]["store-1"], 2);
  assert.equal(stocked.stockDetail["product-1"]["store-2"], 0);
});

test("without the visibility field, all priced active products are included", async () => {
  hasVisibilityField = false;
  const snapshot = await fetchCatalog();
  assert.deepEqual(snapshot.products.map((product) => product.name).sort(), [
    "Жидкость Тестовая 10 мл",
    "Паучи тестовые 4 мг",
    "Полное название публичного товара",
    "Скрытый",
  ]);
  assert.equal(
    snapshot.products.find((product) => product.name === "Скрытый")?.offers
      .length,
    5,
  );
});

test("stock uses warehouse IDs despite renamed or duplicate accounting names", async () => {
  const snapshot = await fetchCatalog();
  snapshot.meta.stores.find((store) => store.id === "store-1").name =
    "Одинаковое имя";
  snapshot.meta.stores.find((store) => store.id === "store-2").name =
    "Одинаковое имя";
  const mockedFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify(
        collection([
          {
            meta: {
              href: "https://api.moysklad.ru/api/remap/1.2/entity/product/product-1",
            },
            stockByStore: [
              {
                meta: {
                  href: "https://api.moysklad.ru/api/remap/1.2/entity/store/store-1?expand=foo",
                },
                name: "Старое имя",
                stock: 7,
                reserve: 2,
              },
              {
                meta: {
                  href: "https://api.moysklad.ru/api/remap/1.2/entity/store/store-2",
                },
                stock: 3,
                reserve: 1,
              },
              {
                meta: {
                  href: "https://api.moysklad.ru/api/remap/1.2/entity/store/internal",
                },
                name: "Буровая",
                stock: 100,
              },
              { name: "Одинаковое имя", stock: 100 },
            ],
          },
        ]),
      ),
    );
  try {
    const stocked = await fetchStock(snapshot);
    const offers = stocked.products.find(
      (product) => product.id === "product-1",
    ).offers;
    assert.equal(
      offers.find((offer) => offer.storeId === "store-1").availability,
      "available",
    );
    assert.equal(
      offers.find((offer) => offer.storeId === "store-2").availability,
      "low",
    );
    assert.equal(
      offers.find((offer) => offer.storeId === "hidden-2").availability,
      "unavailable",
    );
  } finally {
    globalThis.fetch = mockedFetch;
  }
});

test("owner addresses survive warehouse renames; archived and service stores stay excluded", async () => {
  const mockedFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    if (!new URL(String(input)).pathname.endsWith("/entity/store"))
      return mockedFetch(input);
    return new Response(
      JSON.stringify(
        collection([
          {
            id: "84979593-dcdc-11f0-0a80-190b00100ce2",
            name: "Буровая (новое название)",
            pathName: "Саратов",
            address: "",
          },
          {
            id: "archived",
            name: "Чапаева 45",
            pathName: "Саратов",
            archived: true,
          },
          { id: "internal", name: "РЦ Южный", pathName: "Москва" },
          { id: "ungrouped", name: "Без группы", pathName: "" },
        ]),
      ),
    );
  };
  try {
    const snapshot = await fetchCatalog();
    assert.equal(snapshot.meta.stores.length, 1);
    assert.equal(snapshot.meta.stores[0].address, "ул. Буровая, 25");
    assert.equal(snapshot.meta.stores[0].name, "Буровая (новое название)");
  } finally {
    globalThis.fetch = mockedFetch;
  }
});

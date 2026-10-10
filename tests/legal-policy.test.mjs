import { test } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { classifyRootCategory, HIDDEN_SUBCATEGORY_IDS } = await jiti.import(
  "../shared/legal/classification.ts",
);
const { applyLegalPolicy, enforceRegionalRestrictions } = await jiti.import(
  "../shared/legal/catalog-policy.ts",
);
const { activeRestrictionFor, REGIONAL_RESTRICTIONS } = await jiti.import(
  "../shared/legal/regional-restrictions.ts",
);
const { findBelowMinimum, extractVolumeMl } = await jiti.import(
  "../shared/legal/min-prices.ts",
);

const product = (overrides = {}) => ({
  id: "p",
  slug: "p",
  sku: "s",
  name: "Товар",
  categoryId: "c",
  images: [],
  description: "Описание товара.",
  attributes: [],
  offers: [
    {
      storeId: "st1",
      price: 100000,
      currency: "RUB",
      availability: "available",
    },
    {
      storeId: "st3",
      price: 120000,
      currency: "RUB",
      availability: "available",
    },
  ],
  publishedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const snapshot = (categories, products) => ({
  updatedAt: 0,
  stockUpdatedAt: 0,
  meta: {
    cities: [
      { id: "saratov", name: "Саратов" },
      { id: "moscow", name: "Москва" },
    ],
    stores: [
      { id: "st1", cityId: "saratov", name: "Саратов", description: "" },
      { id: "st3", cityId: "moscow", name: "Москва", description: "" },
    ],
    categories,
    brands: [],
    materials: [],
  },
  products,
});

test("root category classification", () => {
  assert.equal(classifyRootCategory(" Жидкости "), "REGULATED_NICOTINE");
  assert.equal(classifyRootCategory("одноразовые ЭС"), "REGULATED_NICOTINE");
  assert.equal(classifyRootCategory("КАЛЬЯНЫ"), "REGULATED_HOOKAH");
  // Безтабачные паучи (подтверждено владельцем) — оборот разрешён.
  assert.equal(classifyRootCategory("жевательный табак"), "REGULATED_POUCH");
  assert.equal(classifyRootCategory("СИГАРЕТЫ"), "BANNED_FROM_SITE");
  assert.equal(classifyRootCategory("нбс"), "BANNED_FROM_SITE");
  // Пищевые ароматизаторы — публикация подтверждена владельцем 10.10.2026.
  assert.equal(classifyRootCategory("Ароматизаторы"), "UNREGULATED");
  // Неизвестные и отсутствующие категории не публикуются.
  assert.equal(classifyRootCategory("Новая категория"), "PENDING_REVIEW");
  assert.equal(classifyRootCategory(undefined), "PENDING_REVIEW");
});

test("applyLegalPolicy hides banned and unclassified, keeps owner-written descriptions", () => {
  const categories = [
    {
      id: "snack",
      name: "Снеки",
      slug: "snack",
      description: "",
      parentId: null,
    },
    {
      id: "snack-sub",
      name: "Чипсы",
      slug: "snack-sub",
      description: "",
      parentId: "snack",
    },
    {
      id: "liq",
      name: "Жидкости",
      slug: "liq",
      description: "",
      parentId: null,
    },
    {
      id: "chew",
      name: "Жевательный табак",
      slug: "chew",
      description: "",
      parentId: null,
    },
    {
      id: "aroma",
      name: "Ароматизаторы",
      slug: "aroma",
      description: "",
      parentId: null,
    },
    // Подкатегория из чёрного списка владельца (HIDDEN_SUBCATEGORY_IDS).
    {
      id: [...HIDDEN_SUBCATEGORY_IDS][0],
      name: "ХС МОТИВАЦИЯ",
      slug: "hs-motivatsiya",
      description: "",
      parentId: "liq",
    },
    {
      id: "unknown",
      name: "Что-то новое",
      slug: "unknown",
      description: "",
      parentId: null,
    },
  ];
  const products = [
    product({ id: "snack-1", categoryId: "snack-sub" }),
    product({ id: "liq-1", categoryId: "liq" }),
    product({ id: "chew-1", categoryId: "chew" }),
    product({ id: "aroma-1", categoryId: "aroma" }),
    product({
      id: "hidden-sub-1",
      categoryId: [...HIDDEN_SUBCATEGORY_IDS][0],
    }),
    product({ id: "unknown-1", categoryId: "unknown" }),
    product({ id: "no-cat-1", categoryId: "missing" }),
  ];
  const result = applyLegalPolicy(snapshot(categories, products));
  assert.deepEqual(result.products.map((item) => item.id).sort(), [
    "aroma-1",
    "chew-1",
    "liq-1",
    "snack-1",
  ]);
  const names = result.meta.categories.map((item) => item.name);
  assert.ok(!names.includes("Что-то новое"));
  // Подкатегория из чёрного списка владельца скрыта вместе с товарами
  // (решение от 10.10.2026: «ХС МОТИВАЦИЯ» — «вот это убрать»).
  assert.ok(!names.includes("ХС МОТИВАЦИЯ"));
  assert.deepEqual(names.sort(), [
    "Ароматизаторы",
    "Жевательный табак",
    "Жидкости",
    "Снеки",
    "Чипсы",
  ]);
  // Описания публикуются для всех классов по решению владельца от
  // 10.10.2026: тексты готовятся в МойСклад самим продавцом.
  const liquid = result.products.find((item) => item.id === "liq-1");
  assert.equal(liquid.legalClass, "REGULATED_NICOTINE");
  assert.equal(liquid.description, "Описание товара.");
  const pouch = result.products.find((item) => item.id === "chew-1");
  assert.equal(pouch.legalClass, "REGULATED_POUCH");
  assert.equal(pouch.description, "Описание товара.");
  const snack = result.products.find((item) => item.id === "snack-1");
  assert.equal(snack.legalClass, "UNREGULATED");
  assert.equal(snack.description, "Описание товара.");
  // Идемпотентность.
  const twice = applyLegalPolicy(result);
  assert.deepEqual(twice.products, result.products);
  assert.deepEqual(twice.meta.categories, result.meta.categories);
});

test("regional restrictions activate by date and filter store offers", () => {
  const saratovBan = REGIONAL_RESTRICTIONS.find((item) =>
    item.regions.includes("saratov"),
  );
  assert.ok(saratovBan.regions.includes("engels"));
  assert.equal(saratovBan.effectiveFrom, "2027-03-01");
  assert.equal(
    activeRestrictionFor("saratov", new Date("2027-02-28")) === undefined,
    true,
  );
  assert.notEqual(
    activeRestrictionFor("saratov", new Date("2027-03-01")),
    undefined,
  );
  // Энгельс — тот же субъект (Саратовская область), запрет действует и там.
  assert.notEqual(
    activeRestrictionFor("engels", new Date("2027-03-01")),
    undefined,
  );
  assert.equal(
    activeRestrictionFor("moscow", new Date("2027-06-01")),
    undefined,
  );

  const stores = snapshot([], []).meta.stores;
  const products = [
    product({ id: "liq", categoryId: "liq", legalClass: "REGULATED_NICOTINE" }),
    product({ id: "snack", categoryId: "snack", legalClass: "UNREGULATED" }),
    product({
      id: "pouch",
      categoryId: "chew",
      legalClass: "REGULATED_POUCH",
    }),
    product({
      id: "liq-saratov-only",
      categoryId: "liq",
      legalClass: "REGULATED_NICOTINE",
      offers: [
        {
          storeId: "st1",
          price: 100000,
          currency: "RUB",
          availability: "available",
        },
      ],
    }),
  ];
  // До вступления запрета всё видно.
  assert.equal(
    enforceRegionalRestrictions(products, stores, new Date("2026-10-01"))
      .length,
    4,
  );
  // После 01.03.2027 в Саратове исчезают запрещённые офферы и товары без
  // оставшихся офферов; Москва не затронута. Паучи не входят в предмет
  // запрета (закон об ЭСДН и жидкостях) — их офферы сохраняются.
  const after = enforceRegionalRestrictions(
    products,
    stores,
    new Date("2027-03-01"),
  );
  assert.equal(after.length, 3);
  const liquid = after.find((item) => item.id === "liq");
  assert.deepEqual(
    liquid.offers.map((offer) => offer.storeId),
    ["st3"],
  );
  const pouch = after.find((item) => item.id === "pouch");
  assert.deepEqual(
    pouch.offers.map((offer) => offer.storeId),
    ["st1", "st3"],
  );
  assert.ok(!after.some((item) => item.id === "liq-saratov-only"));
});

test("minimum price helper parses volumes and flags regulated liquids only", () => {
  assert.equal(extractVolumeMl("Жидкость X, 30мл"), 30);
  assert.equal(extractVolumeMl("Жидкость Y 10 мл"), 10);
  assert.equal(extractVolumeMl("Одноразка 25000 затяжек"), null);
  const config = {
    bottlePerMl: 100,
    cartridgePerMl: 120,
    disposablePerMl: 130,
  };
  const products = [
    product({
      id: "cheap",
      sku: "CHEAP",
      name: "Жидкость Дешёвая 10 мл",
      legalClass: "REGULATED_NICOTINE",
      offers: [
        {
          storeId: "st1",
          price: 50000,
          currency: "RUB",
          availability: "available",
        },
      ],
    }),
    product({
      id: "fine",
      sku: "FINE",
      name: "Жидкость Нормальная 10 мл",
      legalClass: "REGULATED_NICOTINE",
      offers: [
        {
          storeId: "st1",
          price: 1500000,
          currency: "RUB",
          availability: "available",
        },
      ],
    }),
    product({
      id: "snack",
      sku: "SNACK",
      name: "Снек 10 мл",
      legalClass: "UNREGULATED",
      offers: [
        {
          storeId: "st1",
          price: 10000,
          currency: "RUB",
          availability: "available",
        },
      ],
    }),
  ];
  const below = findBelowMinimum(products, config);
  assert.equal(below.length, 1);
  assert.equal(below[0].sku, "CHEAP");
  assert.equal(below[0].pricePerMl, 50);
  // Пороги не заданы — проверка отключена, цены не меняются.
  assert.deepEqual(findBelowMinimum(products), []);
});

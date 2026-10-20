import { test } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  classifyRootCategory,
  AGE_PUBLIC_ROOT_CATEGORIES,
  HIDDEN_SUBCATEGORY_IDS,
  HIDDEN_PRODUCT_NAME_PREFIXES,
  isAgePublicRootCategory,
} = await jiti.import("../shared/legal/classification.ts");
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
  // Сигареты публикуются по решению владельца 11.10.2026 (ранее скрыты).
  assert.equal(classifyRootCategory("СИГАРЕТЫ"), "REGULATED_TOBACCO");
  // Снеки публикуются (решение 11.10 — убрать; отменено 13.10.2026) и
  // входят в общедоступный ассортимент.
  assert.equal(classifyRootCategory("Снеки"), "UNREGULATED");
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
      name: "Напитки",
      slug: "snack",
      description: "",
      parentId: null,
    },
    {
      id: "snack-sub",
      name: "Соки",
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
    // Та же скрытая линейка «БНСЖ …», но в другой (легитимной) папке.
    product({
      id: "hidden-line-1",
      categoryId: "liq",
      name: `${HIDDEN_PRODUCT_NAME_PREFIXES[0]} Хотспот Аура Манго`,
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
    "Напитки",
    "Соки",
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

test("energy drink folders under Напитки publish behind the 18+ gate, soda stays public", () => {
  // Решение владельца 20.10.2026: частичная отмена решения 11.10 — папки
  // энергетиков под корнем «Напитки» возвращаются на сайт, но не наследуют
  // общедоступность корня (видны только после подтверждения 18+).
  const categories = [
    {
      id: "drinks",
      name: "Напитки",
      slug: "drinks",
      description: "",
      parentId: null,
    },
    {
      id: "7b4b66ef-37d4-11f1-0a80-1a0f003cd8b1",
      name: "Monster Energy",
      slug: "monster",
      description: "",
      parentId: "drinks",
    },
    {
      id: "17a5d0a0-453c-11f1-0a80-0b9c00222c40",
      name: "LitEnergy",
      slug: "lit",
      description: "",
      parentId: "drinks",
    },
    {
      id: "17d01010-453c-11f1-0a80-0b9c00222c6a",
      name: "Scandalist",
      slug: "scandalist",
      description: "",
      parentId: "drinks",
    },
    {
      id: "d71e934e-43b6-11f1-0a80-14b8002312bf",
      name: "HQD",
      slug: "hqd-drinks",
      description: "",
      parentId: "drinks",
    },
    {
      id: "monster-sub",
      name: "Monster Ultra",
      slug: "monster-ultra",
      description: "",
      parentId: "7b4b66ef-37d4-11f1-0a80-1a0f003cd8b1",
    },
    {
      id: "cola",
      name: "Coca Cola",
      slug: "cola",
      description: "",
      parentId: "drinks",
    },
  ];
  const products = [
    product({
      id: "monster-1",
      categoryId: "7b4b66ef-37d4-11f1-0a80-1a0f003cd8b1",
    }),
    product({
      id: "lit-1",
      categoryId: "17a5d0a0-453c-11f1-0a80-0b9c00222c40",
    }),
    product({
      id: "scandalist-1",
      categoryId: "17d01010-453c-11f1-0a80-0b9c00222c6a",
    }),
    product({
      id: "hqd-drink-1",
      categoryId: "d71e934e-43b6-11f1-0a80-14b8002312bf",
    }),
    // Вложенная папка энергетика наследует гейт вместе с веткой.
    product({ id: "monster-ultra-1", categoryId: "monster-sub" }),
    product({ id: "cola-1", categoryId: "cola" }),
  ];
  const result = applyLegalPolicy(snapshot(categories, products));
  // Все позиции публикуются (скрытых папок больше нет)…
  assert.deepEqual(result.products.map((item) => item.id).sort(), [
    "cola-1",
    "hqd-drink-1",
    "lit-1",
    "monster-1",
    "monster-ultra-1",
    "scandalist-1",
  ]);
  assert.deepEqual(
    result.meta.categories.map((item) => item.name),
    [
      "Напитки",
      "Monster Energy",
      "LitEnergy",
      "Scandalist",
      "HQD",
      "Monster Ultra",
      "Coca Cola",
    ],
  );
  // …но энергетики (и их вложенные папки) не видны до подтверждения 18+.
  const gated = new Set([
    "7b4b66ef-37d4-11f1-0a80-1a0f003cd8b1",
    "17a5d0a0-453c-11f1-0a80-0b9c00222c40",
    "17d01010-453c-11f1-0a80-0b9c00222c6a",
    "d71e934e-43b6-11f1-0a80-14b8002312bf",
    "monster-sub",
  ]);
  for (const category of result.meta.categories) {
    assert.equal(
      category.agePublic,
      !gated.has(category.id),
      `${category.name}: agePublic`,
    );
  }
  for (const item of result.products) {
    const expectPublic = !gated.has(item.categoryId);
    assert.equal(item.agePublic, expectPublic, `${item.id}: agePublic`);
  }
});

test("age-public assortment is exactly the owner list of 13.10.2026", () => {
  // Решение владельца 13.10.2026: лапша, китайский чай, ароматизаторы,
  // глицерин, снеки и напитки (без энергетиков — те скрыты папками)
  // видны до подтверждения 18+. Состав множества проверяем явно:
  // случайное расширение списка — юридически чувствительно.
  assert.deepEqual([...AGE_PUBLIC_ROOT_CATEGORIES].sort(), [
    "ароматизаторы",
    "глицерин",
    "китайский чай",
    "лапша быстрого приготовления",
    "напитки",
    "снеки",
  ]);
  // Нормализация как в classifyRootCategory.
  assert.equal(isAgePublicRootCategory("  Напитки "), true);
  assert.equal(isAgePublicRootCategory("Китайский  Чай"), true);
  // Регулируемые и неизвестные корни общедоступными не становятся.
  assert.equal(isAgePublicRootCategory("Жидкости"), false);
  assert.equal(isAgePublicRootCategory("Зажигалки"), false);
  assert.equal(isAgePublicRootCategory("Новая категория"), false);
  assert.equal(isAgePublicRootCategory(undefined), false);
});

test("applyLegalPolicy marks categories and products with agePublic by root", () => {
  const categories = [
    {
      id: "drinks",
      name: "Напитки",
      slug: "drinks",
      description: "",
      parentId: null,
    },
    {
      id: "cola",
      name: "Coca Cola",
      slug: "cola",
      description: "",
      parentId: "drinks",
    },
    {
      id: "noodle",
      name: "Лапша быстрого приготовления",
      slug: "noodle",
      description: "",
      parentId: null,
    },
    {
      id: "tea",
      name: "Китайский чай",
      slug: "tea",
      description: "",
      parentId: null,
    },
    {
      id: "glycerin",
      name: "Глицерин",
      slug: "glycerin",
      description: "",
      parentId: null,
    },
    {
      id: "snack",
      name: "Снеки",
      slug: "snack",
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
  ];
  const products = [
    product({ id: "cola-1", categoryId: "cola" }),
    product({ id: "noodle-1", categoryId: "noodle" }),
    product({ id: "tea-1", categoryId: "tea" }),
    product({ id: "glycerin-1", categoryId: "glycerin" }),
    product({ id: "snack-1", categoryId: "snack" }),
    product({ id: "aroma-1", categoryId: "aroma" }),
    product({ id: "liq-1", categoryId: "liq" }),
    product({ id: "chew-1", categoryId: "chew" }),
  ];
  const result = applyLegalPolicy(snapshot(categories, products));
  const flag = (id) => result.products.find((item) => item.id === id).agePublic;
  // Подкатегория наследует доступность корня (Coca Cola ← Напитки).
  assert.equal(flag("cola-1"), true);
  assert.equal(flag("noodle-1"), true);
  assert.equal(flag("tea-1"), true);
  assert.equal(flag("glycerin-1"), true);
  assert.equal(flag("snack-1"), true);
  assert.equal(flag("aroma-1"), true);
  // Регулируемые классы остаются за гейтом.
  assert.equal(flag("liq-1"), false);
  assert.equal(flag("chew-1"), false);
  const categoryFlag = (slug) =>
    result.meta.categories.find((item) => item.slug === slug).agePublic;
  assert.equal(categoryFlag("cola"), true);
  assert.equal(categoryFlag("aroma"), true);
  assert.equal(categoryFlag("liq"), false);
  // Идемпотентность флага.
  const twice = applyLegalPolicy(result);
  assert.deepEqual(
    twice.products.map((item) => [item.id, item.agePublic]),
    result.products.map((item) => [item.id, item.agePublic]),
  );
});

test("image restriction keeps photos of age-public products", async () => {
  // Серверный срез изображений: общедоступные товары сохраняют фото для
  // всех (включая анонимов), регулируемые — только для adult-сессий.
  const { restrictProductImages, restrictMetaImages } = await jiti.import(
    "../server/utils/product-images.ts",
  );
  const publicProduct = product({
    id: "cola-1",
    categoryId: "cola",
    agePublic: true,
    images: [{ id: "i", src: "/api/products/p/0", alt: "" }],
  });
  const restricted = restrictProductImages(publicProduct);
  assert.equal(restricted.images.length, 1);
  assert.equal(restricted.imagesRestricted, undefined);
  const regulated = product({
    id: "liq-1",
    categoryId: "liq",
    agePublic: false,
    images: [{ id: "i", src: "/api/products/q/0", alt: "" }],
  });
  const stripped = restrictProductImages(regulated);
  assert.deepEqual(stripped.images, []);
  assert.equal(stripped.imagesRestricted, true);
  // Обложки категорий: у общедоступных остаются, у остальных срезаются.
  const meta = {
    categories: [
      {
        ...publicProduct,
        id: "cola",
        slug: "cola",
        agePublic: true,
        image: "/api/products/p/0",
      },
      {
        ...regulated,
        id: "liq",
        slug: "liq",
        agePublic: false,
        image: "/api/products/q/0",
      },
    ],
  };
  const metaResult = restrictMetaImages(meta);
  assert.equal(metaResult.categories[0].image, "/api/products/p/0");
  assert.equal(metaResult.categories[1].image, undefined);
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

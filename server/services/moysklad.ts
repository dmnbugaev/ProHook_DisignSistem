import type { CatalogMeta } from "../../shared/types/catalog";
import type { Product } from "../../shared/types/product";
import type { Store } from "../../shared/types/store";
import { applyLegalPolicy } from "../../shared/legal/catalog-policy";
import { storeAddresses } from "../data/store-addresses";
import { storeLicenses } from "../data/store-licenses";

const API = "https://api.moysklad.ru/api/remap/1.2/";
const PAGE_SIZE = 1000;
const INTERNAL_STORES = new Set([
  "РЦ Саратов",
  "Саратов",
  "Москва",
  "СКЛАД ЮЛИЯ",
  "СКЛАД ЕЛЕНА",
  "СКЛАД АНАСТАСИЯ",
  "Доставка",
  "БРАК/ПРОСРОЧКА",
  "ожидает отправки",
  "БУНКЕР",
  "САМОВЫВОЗ",
  "шаблон",
]);
// Учётные имена складов-распределителей могут нести суффиксы («РЦ Южный -
// Хлам»), точного совпадения с INTERNAL_STORES недостаточно.
function isInternalStore(name: string): boolean {
  return INTERNAL_STORES.has(name) || name.trim().startsWith("РЦ");
}

// Точки физически расположены в Энгельсе (подтверждено публичной
// Яндекс.Картой: организации «ПроХук», см. docs/STORE-MAPPING.md), хотя в
// учётной системе лежат в группе «Саратов». Цены — как в Саратове.
const ENGELS_STORE_IDS = new Set([
  "06251449-db11-11f0-0a80-181f0005085f", // Тельмана, 6
  "5c684bc5-dcda-11f0-0a80-1823000f8fc6", // Тельмана, 29
]);

interface MsMeta {
  href: string;
  size?: number;
}
interface MsCollection<T> {
  meta: MsMeta;
  rows: T[];
}
interface MsReference {
  meta?: MsMeta;
}
interface MsStore {
  id: string;
  name: string;
  archived?: boolean;
  pathName?: string;
  address?: string;
  description?: string;
}
interface MsFolder {
  id: string;
  name: string;
  archived?: boolean;
  productFolder?: MsReference;
}
interface MsPrice {
  value: number;
  priceType?: { name?: string };
}
interface MsProduct {
  id: string;
  name: string;
  archived?: boolean;
  article?: string;
  code?: string;
  description?: string;
  productFolder?: MsReference;
  salePrices?: MsPrice[];
  images?: { meta?: MsMeta };
  updated?: string;
  attributes?: Array<{
    id?: string;
    name?: string;
    meta?: MsMeta;
    value?: unknown;
  }>;
}
interface MsAttribute {
  id: string;
  name: string;
  type?: string;
}
interface MsStockStore {
  name?: string;
  stock?: number;
  reserve?: number;
  meta?: MsMeta;
}
interface MsStockRow {
  meta?: MsMeta;
  stockByStore?: MsStockStore[];
}

function token() {
  const value = process.env.NUXT_MOYSKLAD_TOKEN || process.env.MOYSKLAD_TOKEN;
  if (!value) throw new Error("MOYSKLAD_TOKEN is not configured");
  return value;
}

export async function moyskladFetch(
  path: string,
  timeout = 60000,
  binary = false,
): Promise<Response> {
  const url = new URL(path, API);
  if (
    url.origin !== new URL(API).origin ||
    !url.pathname.startsWith("/api/remap/1.2/")
  )
    throw new Error("Unexpected MoySklad URL");
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      headers: binary
        ? { Authorization: `Bearer ${token()}` }
        : {
            Authorization: `Bearer ${token()}`,
            Accept: "application/json;charset=utf-8",
            "Accept-Encoding": "gzip",
          },
      signal: AbortSignal.timeout(timeout),
    });
    if (response.ok) return response;
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1500));
      continue;
    }
    throw new Error(`MoySklad request failed: HTTP ${response.status}`);
  }
  throw new Error("MoySklad request failed");
}

async function allRows<T>(path: string, timeout = 60000): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = new URL(path, API);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));
    const response = await moyskladFetch(url.toString(), timeout);
    const page = (await response.json()) as MsCollection<T>;
    rows.push(...page.rows);
    if (
      page.rows.length < PAGE_SIZE ||
      rows.length >= (page.meta.size ?? Infinity)
    )
      break;
  }
  return rows;
}

function idOf(ref?: MsReference): string | undefined {
  return ref?.meta?.href?.split("?")[0]?.split("/").at(-1);
}

/** Название корневой папки товара (юридический класс и фасовка — от корня). */
function rootFolderName(
  folderId: string | undefined,
  folderMap: Map<string, MsFolder>,
): string | undefined {
  let current = folderId ? folderMap.get(folderId) : undefined;
  const visited = new Set<string>();
  let rootName = current?.name;
  while (current?.productFolder && !visited.has(current.id)) {
    visited.add(current.id);
    const parentId = idOf(current.productFolder);
    current = parentId ? folderMap.get(parentId) : undefined;
    if (current) rootName = current.name;
  }
  return rootName;
}

function cityFor(store: MsStore) {
  if (ENGELS_STORE_IDS.has(store.id)) return "engels";
  if (store.pathName === "Москва") return "moscow";
  return store.pathName === "Саратов" ? "saratov" : undefined;
}

export interface CatalogSnapshot {
  updatedAt: number;
  stockUpdatedAt: number;
  meta: CatalogMeta;
  products: Product[];
  /**
   * Точные остатки штук для проверки запросов на резерв: productId →
   * storeId → доступно (stock − reserve). Только server-side: API каталога
   * отдаёт products/meta, это поле наружу не попадает.
   */
  stockDetail?: Record<string, Record<string, number>>;
}

export async function fetchCatalog(): Promise<CatalogSnapshot> {
  const [msStores, folders, msProducts, productAttributes] = await Promise.all([
    allRows<MsStore>("entity/store"),
    allRows<MsFolder>("entity/productfolder"),
    allRows<MsProduct>("entity/product?filter=archived=false"),
    allRows<MsAttribute>("entity/product/metadata/attributes"),
  ]);
  const publishField = productAttributes.find(
    (field) =>
      field.name.trim().toLocaleLowerCase("ru") === "показать на сайте",
  );
  const siteNameField = productAttributes.find(
    (field) =>
      field.name.trim().toLocaleLowerCase("ru") === "название для сайта",
  );
  const stores: Store[] = msStores
    .filter(
      (item) =>
        !item.archived && !isInternalStore(item.name.trim()) && cityFor(item),
    )
    .map((item) => ({
      id: item.id,
      cityId: cityFor(item)!,
      name: item.name,
      // Нейтральный фолбэк: адрес точки показывается отдельной строкой.
      description: item.description?.trim() || "Магазин сети Прохук",
      ...(storeAddresses[item.id] || item.address?.trim()
        ? { address: storeAddresses[item.id] || item.address!.trim() }
        : {}),
      ...(storeLicenses[item.id] ? { license: storeLicenses[item.id] } : {}),
    }))
    .sort(
      (a, b) =>
        a.cityId.localeCompare(b.cityId) || a.name.localeCompare(b.name, "ru"),
    );
  const folderMap = new Map(folders.map((item) => [item.id, item]));
  const visible = msProducts.filter((item) => {
    const prices = item.salePrices ?? [];
    const published =
      !publishField ||
      Boolean(
        item.attributes?.some(
          (attribute) =>
            (attribute.id === publishField.id ||
              attribute.meta?.href?.endsWith(`/${publishField.id}`) ||
              attribute.name === publishField.name) &&
            (attribute.value === true ||
              (typeof attribute.value === "string" &&
                ["да", "true", "1"].includes(
                  attribute.value.toLocaleLowerCase("ru"),
                ))),
        ),
      );
    return (
      !item.archived &&
      published &&
      ["Цена продажи", "Москва"].some((type) =>
        prices.some(
          (price) => price.priceType?.name === type && price.value > 0,
        ),
      )
    );
  });
  const usedFolders = new Set<string>();
  for (const item of visible) {
    let id = idOf(item.productFolder);
    while (id && !usedFolders.has(id)) {
      usedFolders.add(id);
      id = idOf(folderMap.get(id)?.productFolder);
    }
  }
  const categories: CatalogMeta["categories"] = folders
    .filter((folder) => usedFolders.has(folder.id) && !folder.archived)
    .map((folder) => ({
      id: folder.id,
      slug: folder.id,
      name: folder.name,
      description: `Товары категории «${folder.name}».`,
      parentId: idOf(folder.productFolder) ?? null,
    }));
  const categoryNames = new Map(categories.map((item) => [item.id, item.name]));
  // legalClass назначается ниже централизованно (applyLegalPolicy).
  const products = visible
    .map((item) => {
      const siteNameValue = item.attributes?.find(
        (attribute) =>
          siteNameField &&
          (attribute.id === siteNameField.id ||
            attribute.meta?.href
              ?.split("?")[0]
              ?.endsWith(`/${siteNameField.id}`) ||
            attribute.name?.trim().toLocaleLowerCase("ru") ===
              "название для сайта"),
      )?.value;
      const name =
        typeof siteNameValue === "string" && siteNameValue.trim()
          ? siteNameValue.trim()
          : item.name;
      const categoryId = idOf(item.productFolder) ?? "";
      const prices = new Map(
        (item.salePrices ?? []).map((price) => [
          price.priceType?.name,
          price.value,
        ]),
      );
      const imageCount = Math.min(5, item.images?.meta?.size ?? 0);
      const offers = stores.flatMap((store) => {
        const price =
          prices.get(store.cityId === "moscow" ? "Москва" : "Цена продажи") ??
          0;
        return price > 0
          ? [
              {
                storeId: store.id,
                price: Math.round(price),
                currency: "RUB" as const,
                availability: "unknown" as const,
              },
            ]
          : [];
      });
      const attributes = (item.attributes ?? [])
        .filter(
          (attribute) =>
            typeof attribute.value === "string" &&
            attribute.value &&
            (!siteNameField ||
              (attribute.id !== siteNameField.id &&
                attribute.name?.trim().toLocaleLowerCase("ru") !==
                  "название для сайта")),
        )
        .map((attribute) => ({
          code: attribute.id ?? attribute.name ?? "",
          name: attribute.name ?? "Характеристика",
          value: String(attribute.value),
        }));
      return {
        id: item.id,
        slug: item.id,
        sku: item.article || item.code || item.id,
        name,
        categoryId,
        categoryName: categoryNames.get(categoryId) ?? "Каталог",
        images: Array.from({ length: imageCount }, (_, index) => ({
          id: `${item.id}-${index}`,
          src: `/api/products/${item.id}/images/${index}`,
          alt: `${name} — изображение ${index + 1}`,
        })),
        // Фасовка по корневой категории: китайский чай продаётся порционно
        // по 10 г (владелец, 10.10.2026), остальной ассортимент — по 1 шт.
        unit:
          rootFolderName(idOf(item.productFolder), folderMap)
            ?.trim()
            .toLocaleLowerCase("ru") === "китайский чай"
            ? "10 г"
            : "1 шт",
        // Описание берётся из МойСклад как есть; пустое не подменяется
        // заглушкой — карточка просто не показывает блок «О товаре».
        description: item.description?.trim() ?? "",
        attributes,
        offers,
        publishedAt: item.updated ? item.updated.replace(" ", "T") + "Z" : "",
      };
    })
    .filter((item) => item.offers.length > 0);
  // Юридическая политика применяется к снимку до подсчёта категорий:
  // запрещённые и неклассифицированные категории и товары не публикуются,
  // у регулируемых классов убираются свободные описания.
  const classified = applyLegalPolicy({
    updatedAt: Date.now(),
    stockUpdatedAt: 0,
    meta: {
      cities: [
        { id: "saratov", name: "Саратов" },
        { id: "engels", name: "Энгельс" },
        { id: "moscow", name: "Москва" },
      ],
      stores,
      categories,
      brands: [],
      materials: [],
    },
    products,
  });
  const categoryById = new Map(
    classified.meta.categories.map((category) => [category.id, category]),
  );
  const rootCounts = new Map<string, number>();
  for (const product of classified.products) {
    let id: string | null = product.categoryId;
    const visited = new Set<string>();
    while (id && !visited.has(id)) {
      visited.add(id);
      const category = categoryById.get(id);
      if (!category) break;
      if (!category.image && product.images[0])
        category.image = product.images[0].src;
      if (!category.parentId) rootCounts.set(id, (rootCounts.get(id) ?? 0) + 1);
      id = category.parentId;
    }
  }
  classified.meta.categories.sort((a, b) =>
    !a.parentId && !b.parentId
      ? (rootCounts.get(b.id) ?? 0) - (rootCounts.get(a.id) ?? 0) ||
        a.name.localeCompare(b.name, "ru")
      : a.name.localeCompare(b.name, "ru"),
  );
  return classified;
}

export async function fetchStock(snapshot: CatalogSnapshot): Promise<{
  products: Product[];
  stockDetail: CatalogSnapshot["stockDetail"];
}> {
  const rows = await allRows<MsStockRow>(
    "report/stock/bystore?filter=stockMode=nonEmpty",
    120000,
  );
  const productStock = new Map<string, Map<string, number>>();
  const storeIds = new Set(snapshot.meta.stores.map((store) => store.id));
  // Older responses without metadata may be matched only by a unique name.
  const storesByName = new Map<string, string | undefined>();
  for (const store of snapshot.meta.stores) {
    storesByName.set(
      store.name,
      storesByName.has(store.name) ? undefined : store.id,
    );
  }
  for (const row of rows) {
    const id = row.meta?.href?.split("?")[0]?.split("/").at(-1);
    if (!id) continue;
    const byStore = new Map<string, number>();
    for (const entry of row.stockByStore ?? []) {
      const referenceId = idOf(entry);
      const storeId = referenceId
        ? storeIds.has(referenceId)
          ? referenceId
          : undefined
        : entry.name
          ? storesByName.get(entry.name)
          : undefined;
      if (storeId)
        byStore.set(storeId, (entry.stock ?? 0) - (entry.reserve ?? 0));
    }
    productStock.set(id, byStore);
  }
  const stockDetail: NonNullable<CatalogSnapshot["stockDetail"]> = {};
  const products = snapshot.products.map((product) => {
    const byStore = productStock.get(product.id);
    if (byStore && byStore.size > 0) {
      stockDetail[product.id] = Object.fromEntries(byStore);
    }
    return {
      ...product,
      offers: product.offers.map((offer) => {
        const amount = byStore?.get(offer.storeId) ?? 0;
        return {
          ...offer,
          availability:
            amount <= 0
              ? ("unavailable" as const)
              : amount <= 3
                ? ("low" as const)
                : ("available" as const),
        };
      }),
    };
  });
  return { products, stockDetail };
}

const imageLists = new Map<string, { expires: number; urls: string[] }>();

export async function fetchProductImage(
  productId: string,
  index: number,
): Promise<Response> {
  if (
    !/^[0-9a-f-]{36}$/.test(productId) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 4
  )
    throw new Error("Invalid image request");
  let cached = imageLists.get(productId);
  if (!cached || cached.expires < Date.now()) {
    const response = await moyskladFetch(
      `entity/product/${productId}/images?limit=5`,
    );
    const collection = (await response.json()) as MsCollection<{
      meta: MsMeta & { downloadHref?: string };
    }>;
    cached = {
      expires: Date.now() + 5 * 60 * 1000,
      urls: collection.rows.map((image) => image.meta.downloadHref ?? ""),
    };
    imageLists.set(productId, cached);
  }
  const download = cached.urls[index];
  if (!download) throw new Error("Image not found");
  return moyskladFetch(download, 60000, true);
}

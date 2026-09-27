import type { CatalogMeta } from "../../shared/types/catalog";
import type { Product } from "../../shared/types/product";
import type { Store } from "../../shared/types/store";

const API = "https://api.moysklad.ru/api/remap/1.2/";
const PAGE_SIZE = 1000;
const INTERNAL_STORES = new Set([
  "РЦ Южный",
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
const HIDDEN_STORES = new Set(["Вокзал", "Буровая", "Ильинская площадь"]);

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

function cityFor(store: MsStore) {
  if (store.pathName === "Москва") return "moscow";
  return store.pathName === "Саратов" ? "saratov" : undefined;
}

export interface CatalogSnapshot {
  updatedAt: number;
  stockUpdatedAt: number;
  meta: CatalogMeta;
  products: Product[];
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
  const stores: Store[] = msStores
    .filter(
      (item) =>
        !item.archived &&
        !INTERNAL_STORES.has(item.name) &&
        !HIDDEN_STORES.has(item.name) &&
        cityFor(item),
    )
    .map((item) => ({
      id: item.id,
      cityId: cityFor(item)!,
      name: item.name,
      description: item.description?.trim() || `Точка «${item.name}»`,
      ...(item.address?.trim() ? { address: item.address.trim() } : {}),
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
  const products: Product[] = visible
    .map((item) => {
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
          (attribute) => typeof attribute.value === "string" && attribute.value,
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
        name: item.name,
        categoryId,
        categoryName: categoryNames.get(categoryId) ?? "Каталог",
        images: Array.from({ length: imageCount }, (_, index) => ({
          id: `${item.id}-${index}`,
          src: `/api/products/${item.id}/images/${index}`,
          alt: `${item.name} — изображение ${index + 1}`,
        })),
        description:
          item.description?.trim() || "Описание товара пока не добавлено.",
        attributes,
        offers,
        isPopular: false,
        isNew: false,
        publishedAt: item.updated ? item.updated.replace(" ", "T") + "Z" : "",
      };
    })
    .filter((item) => item.offers.length > 0);
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const rootCounts = new Map<string, number>();
  for (const product of products) {
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
  categories.sort((a, b) =>
    !a.parentId && !b.parentId
      ? (rootCounts.get(b.id) ?? 0) - (rootCounts.get(a.id) ?? 0) ||
        a.name.localeCompare(b.name, "ru")
      : a.name.localeCompare(b.name, "ru"),
  );
  return {
    updatedAt: Date.now(),
    stockUpdatedAt: 0,
    meta: {
      cities: [
        { id: "moscow", name: "Москва" },
        { id: "saratov", name: "Саратов" },
      ],
      stores,
      categories,
      brands: [],
      materials: [],
    },
    products,
  };
}

export async function fetchStock(
  snapshot: CatalogSnapshot,
): Promise<Product[]> {
  const rows = await allRows<MsStockRow>(
    "report/stock/bystore?filter=stockMode=nonEmpty",
    120000,
  );
  const productStock = new Map<string, Map<string, number>>();
  const storesByName = new Map(
    snapshot.meta.stores.map((store) => [store.name, store.id]),
  );
  for (const row of rows) {
    const id = row.meta?.href?.split("?")[0]?.split("/").at(-1);
    if (!id) continue;
    const byStore = new Map<string, number>();
    for (const entry of row.stockByStore ?? []) {
      const storeId = entry.name ? storesByName.get(entry.name) : undefined;
      if (storeId)
        byStore.set(storeId, (entry.stock ?? 0) - (entry.reserve ?? 0));
    }
    productStock.set(id, byStore);
  }
  return snapshot.products.map((product) => ({
    ...product,
    offers: product.offers.map((offer) => {
      const amount = productStock.get(product.id)?.get(offer.storeId) ?? 0;
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
  }));
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

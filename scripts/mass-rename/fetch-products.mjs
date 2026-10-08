// Выгрузка всех товаров МойСклада для генерации «Названия для сайта».
// Сохраняет бэкап текущих значений атрибута перед перезаписью.
import console from "node:console";
import process from "node:process";
import { URL } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";

const API = "https://api.moysklad.ru/api/remap/1.2/";
const TOKEN = process.env.NUXT_MOYSKLAD_TOKEN || process.env.MOYSKLAD_TOKEN;
if (!TOKEN) throw new Error("NUXT_MOYSKLAD_TOKEN is not set");

async function msFetch(path, init) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(new URL(path, API), {
      ...init,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/json;charset=utf-8",
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(60000),
    });
    if (response.ok) return response;
    if ((response.status === 429 || response.status >= 500) && attempt < 5) {
      await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
      continue;
    }
    throw new Error(
      `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }
}

async function allRows(path) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = new URL(path, API);
    url.searchParams.set("limit", "1000");
    url.searchParams.set("offset", String(offset));
    const page = await (await msFetch(url.toString())).json();
    rows.push(...page.rows);
    if (page.rows.length < 1000 || rows.length >= (page.meta.size ?? Infinity))
      break;
  }
  return rows;
}

const env = {};
for (const line of readFileSync(
  new URL("../../.env", import.meta.url),
  "utf8",
).split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
process.env.NUXT_MOYSKLAD_TOKEN ||= env.NUXT_MOYSKLAD_TOKEN;

const [attributes, folders, products] = await Promise.all([
  allRows("entity/product/metadata/attributes"),
  allRows("entity/productfolder"),
  allRows("entity/product?filter=archived=false"),
]);

const siteNameField = attributes.find(
  (a) => a.name.trim().toLocaleLowerCase("ru") === "название для сайта",
);
console.log("Attribute fields:");
for (const a of attributes) console.log(`  ${a.id} | ${a.name} | ${a.type}`);
if (!siteNameField) {
  console.log(
    "\nAttribute «Название для сайта» not found — will need to create it (create-attribute.mjs)",
  );
  process.exit(2);
}
console.log(
  `\nFolders: ${folders.length}, products (non-archived): ${products.length}`,
);

const idOf = (ref) => ref?.meta?.href?.split("?")[0]?.split("/").at(-1);
const folderMap = new Map(folders.map((f) => [f.id, f]));

function folderPath(ref) {
  const parts = [];
  let id = idOf(ref);
  const seen = new Set();
  while (id && !seen.has(id)) {
    seen.add(id);
    const folder = folderMap.get(id);
    if (!folder) break;
    parts.unshift(folder.name);
    id = idOf(folder.productFolder);
  }
  return parts.join(" / ");
}

const inventory = products.map((p) => {
  const attr = p.attributes?.find(
    (a) => a.id === siteNameField.id || a.name === siteNameField.name,
  );
  return {
    id: p.id,
    name: p.name,
    article: p.article ?? "",
    code: p.code ?? "",
    description: p.description?.trim() ?? "",
    folder: folderPath(p.productFolder),
    currentSiteName: typeof attr?.value === "string" ? attr.value.trim() : "",
    updated: p.updated ?? "",
  };
});

const needName = inventory.filter(
  (p) => !p.currentSiteName || p.currentSiteName === p.name,
);
console.log(`Need site name: ${needName.length} of ${inventory.length}`);
console.log(
  `Already have distinct site name: ${inventory.length - needName.length}`,
);

writeFileSync(
  new URL("./products-backup.json", import.meta.url),
  JSON.stringify(
    {
      siteNameFieldId: siteNameField.id,
      fetchedAt: new Date().toISOString(),
      inventory,
    },
    null,
    1,
  ),
);
console.log("Saved → scripts/mass-rename/products-backup.json");

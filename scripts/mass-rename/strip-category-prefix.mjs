// Чистка приставок: из «Названия для сайта» убирается ведущая часть,
// совпадающая с именем папки-категории (корневой или любой родительской,
// во всех формах слова), если этих слов не было в исходном названии
// МойСклад. Решение владельца от 11.10.2026 («в базе написано без слова»).
//
//   node strip-category-prefix.mjs           — dry-run: только отчёт
//   node strip-category-prefix.mjs --apply   — бэкап + запись в МойСклад
import console from "node:console";
import process from "node:process";
import { URL } from "node:url";
import { writeFileSync } from "node:fs";
import { msFetch, allRows, idOf } from "./lib.mjs";

const apply = process.argv.includes("--apply");

// Грубые падежно-числовые окончания: стрипаем с конца, пока стем ≥ 3 букв.
const ENDINGS = [
  "ыми",
  "ими",
  "ами",
  "ого",
  "его",
  "ому",
  "ему",
  "ых",
  "их",
  "ая",
  "яя",
  "ое",
  "ее",
  "ые",
  "ие",
  "ой",
  "ый",
  "ий",
  "ов",
  "ев",
  "ам",
  "ям",
  "ах",
  "ях",
  "ую",
  "юю",
  "ем",
  "ом",
  "и",
  "ы",
  "е",
  "а",
  "я",
  "о",
  "у",
  "ю",
  "ь",
];

// Неправильные формы, которые стемминг не сводит: слово папки → варианты.
const EXTRA_STEMS = {
  напитки: ["напиток", "напитк"],
};

function wordStems(word) {
  const cleaned = word
    .toLocaleLowerCase("ru")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  const stems = new Set([cleaned]);
  for (const ending of ENDINGS) {
    if (cleaned.endsWith(ending) && cleaned.length - ending.length >= 3) {
      stems.add(cleaned.slice(0, -ending.length));
    }
  }
  for (const form of EXTRA_STEMS[cleaned] ?? []) {
    stems.add(form.toLocaleLowerCase("ru"));
  }
  return stems;
}

// Исходные токены без схлопывания пробелов: по ним режем приставку.
const tokens = (text) => text.split(/\s+/).filter(Boolean);

function stemsIn(textStems, stems) {
  // Стем присутствует в тексте, если совпадает стем любого его слова.
  return textStems.some((textStemSet) => stems.some((s) => textStemSet.has(s)));
}

/**
 * Длина (в словах) ведущей части siteName, совпадающей по стемам с окном
 * слов имени папки, при условии что ни одно из этих слов не встречается
 * в исходном названии. 0 — приставки нет.
 */
function matchedPrefixLength(siteWords, folderName, baseStems) {
  const folderWords = tokens(folderName);
  const siteStemSets = siteWords.map((word) => new Set(wordStems(word)));
  let best = 0;
  for (let start = 0; start < folderWords.length; start++) {
    for (
      let length = folderWords.length - start;
      length >= 1 && length > best;
      length--
    ) {
      const windowStems = [];
      let matches = true;
      for (let k = 0; k < length; k++) {
        const folderSet = wordStems(folderWords[start + k]);
        const siteSet = siteStemSets[k] ?? new Set();
        if (![...folderSet].some((s) => siteSet.has(s))) {
          matches = false;
          break;
        }
        windowStems.push(folderSet);
      }
      if (!matches) continue;
      // Хотя бы одно содержательное слово (стем ≥ 3 букв).
      if (!windowStems.some((set) => [...set].some((s) => s.length >= 3)))
        continue;
      // Все слова окна должны отсутствовать в исходном названии.
      if (windowStems.some((set) => stemsIn(baseStems, [...set]))) continue;
      if (siteWords.length - length < 1) continue; // после среза должно остаться имя
      best = Math.max(best, length);
      break;
    }
  }
  return best;
}

function cleanUp(text) {
  const rest = text
    .replace(/^[\s\-–—:,.;·]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!rest) return "";
  return rest[0].toLocaleUpperCase("ru") + rest.slice(1);
}

// --- загрузка данных ---
const attributeRows = await allRows("entity/product/metadata/attributes");
const siteNameField = attributeRows.find(
  (field) => field.name.trim().toLocaleLowerCase("ru") === "название для сайта",
);
if (!siteNameField) throw new Error("Поле «Название для сайта» не найдено");

const folders = await allRows("entity/productfolder");
const folderById = new Map(folders.map((item) => [item.id, item]));

function ancestorNames(folderId) {
  const names = [];
  let current = folderById.get(folderId);
  const visited = new Set();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    names.push(current.name);
    current = current.productFolder
      ? folderById.get(idOf(current.productFolder))
      : undefined;
  }
  return names; // [прямая папка, ..., корень]
}

const products = await allRows("entity/product?filter=archived=false");
const changes = [];
for (const product of products) {
  const attribute = (product.attributes ?? []).find(
    (item) => item.id === siteNameField.id,
  );
  const siteName =
    typeof attribute?.value === "string" ? attribute.value.trim() : "";
  if (!siteName) continue;
  const baseName = (product.name ?? "").trim();
  const baseStems = tokens(baseName).map((word) => wordStems(word));
  const siteWords = tokens(siteName);
  let strip = 0;
  for (const folderName of ancestorNames(idOf(product.productFolder) ?? "")) {
    strip = Math.max(
      strip,
      matchedPrefixLength(siteWords, folderName, baseStems),
    );
  }
  if (!strip) continue;
  const next = cleanUp(siteWords.slice(strip).join(" "));
  if (!next || next.length < 3 || next === siteName) continue;
  changes.push({
    id: product.id,
    folder: ancestorNames(idOf(product.productFolder) ?? "")
      .slice()
      .reverse()
      .join(" / "),
    baseName,
    siteName,
    next,
  });
}

// --- отчёт ---
const byFolder = new Map();
for (const change of changes) {
  const list = byFolder.get(change.folder) ?? [];
  list.push(change);
  byFolder.set(change.folder, list);
}
for (const [folder, list] of [...byFolder.entries()].sort()) {
  console.log(`\n=== ${folder} (${list.length}) ===`);
  for (const change of list) {
    console.log(`  ${change.siteName}`);
    console.log(`    ⟹ ${change.next}   [база: ${change.baseName}]`);
  }
}
console.log(
  `\nИтого к правке: ${changes.length} товаров из ${products.length}.`,
);

if (!apply) {
  console.log("dry-run: ничего не записано (запустите с --apply)");
  process.exit(0);
}

// --- запись ---
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = new URL(`./out/strip-backup-${stamp}.json`, import.meta.url);
writeFileSync(backupPath, JSON.stringify(changes, null, 2));
console.log(`Бэкап: ${backupPath.pathname}`);

const FIELD_HREF = `https://api.moysklad.ru/api/remap/1.2/entity/product/metadata/attributes/${siteNameField.id}`;
let done = 0;
let failed = 0;
for (const change of changes) {
  try {
    await msFetch(`entity/product/${change.id}`, {
      method: "PUT",
      body: JSON.stringify({
        attributes: [
          {
            meta: {
              href: FIELD_HREF,
              type: "attributemetadata",
              mediaType: "application/json",
            },
            value: change.next,
          },
        ],
      }),
    });
    done++;
  } catch (error) {
    failed++;
    console.error(`FAIL ${change.id} «${change.siteName}»: ${error.message}`);
  }
}
console.log(`Записано ${done}, ошибок ${failed}.`);

// Контрольное чтение трёх изменённых товаров.
for (const change of changes.slice(0, 3)) {
  const fresh = await (
    await msFetch(`entity/product/${change.id}?limit=1`)
  ).json();
  const value =
    (fresh.attributes ?? []).find((item) => item.id === siteNameField.id)
      ?.value ?? null;
  console.log(
    `${value === change.next ? "OK  " : "FAIL"} ${change.id}: «${value}»`,
  );
}

// Валидация результатов батчей и слияние в единый файл site-names.json.
import console from "node:console";
import process from "node:process";
import { URL } from "node:url";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";

const batchDir = new URL("./batches/", import.meta.url);
const outDir = new URL("./out/", import.meta.url);
const batchFiles = readdirSync(batchDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

const { inventory, siteNameFieldId } = JSON.parse(
  readFileSync(new URL("./products-backup.json", import.meta.url), "utf8"),
);
// Порядок инвентаря = порядок нарезки батчей (prepare-batches сортирует так же).
const sorted = [...inventory].sort(
  (a, b) =>
    a.folder.localeCompare(b.folder, "ru") ||
    a.name.localeCompare(b.name, "ru"),
);

const bad = [];
const merged = [];
let totalNames = 0;

for (const file of batchFiles) {
  const batchNo = Number(file.match(/batch-(\d+)/)[1]);
  const { items } = JSON.parse(readFileSync(new URL(file, batchDir), "utf8"));
  const outPath = new URL(file, outDir);
  if (!existsSync(outPath)) {
    bad.push(`batch ${batchNo}: нет выходного файла`);
    continue;
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(outPath, "utf8"));
  } catch (e) {
    bad.push(`batch ${batchNo}: JSON не парсится — ${e.message}`);
    continue;
  }
  const names = new Map();
  for (const entry of parsed.names ?? []) {
    if (names.has(entry.i)) bad.push(`batch ${batchNo}: дубликат i=${entry.i}`);
    names.set(entry.i, entry.siteName);
  }
  const expected = new Set(items.map((it) => it.i));
  for (const i of expected) {
    const v = names.get(i);
    if (typeof v !== "string" || !v.trim()) {
      bad.push(`batch ${batchNo}: i=${i} отсутствует/пустое`);
      continue;
    }
    if (v.length > 200)
      bad.push(`batch ${batchNo}: i=${i} длиннее 200 (${v.length})`);
    if (/[\u0000-\u001F\u007F\uFEFF\u200B-\u200D]/.test(v))
      bad.push(`batch ${batchNo}: i=${i} управляющие символы`);
    if (v !== v.trim()) bad.push(`batch ${batchNo}: i=${i} пробелы по краям`);
  }
  if (bad.length === 0) {
    for (const it of items) {
      const product = sorted[(batchNo - 1) * 400 + it.i];
      if (!product || product.name !== it.name) {
        bad.push(`batch ${batchNo}: рассинхрон i=${it.i} с инвентарём`);
        break;
      }
      merged.push({
        id: product.id,
        oldName: it.name,
        folder: it.folder,
        siteName: names.get(it.i),
      });
    }
    totalNames += items.length;
  }
}

if (bad.length) {
  console.error(`ПРОБЛЕМЫ (${bad.length}):`);
  for (const b of bad.slice(0, 30)) console.error("  " + b);
  process.exit(1);
}

const changed = merged.filter((m) => m.siteName !== m.oldName).length;
const longest = merged.reduce((a, b) =>
  b.siteName.length > a.siteName.length ? b : a,
);
writeFileSync(
  new URL("./site-names.json", import.meta.url),
  JSON.stringify(
    { siteNameFieldId, generatedAt: new Date().toISOString(), merged },
    null,
    1,
  ),
);
console.log(
  `OK: ${totalNames} названий из ${batchFiles.length} батчей → site-names.json`,
);
console.log(
  `Изменено относительно исходного: ${changed} (${Math.round((changed / merged.length) * 100)}%)`,
);
console.log(
  `Самое длинное (${longest.siteName.length}): «${longest.siteName}»`,
);

// Запись «Названия для сайта» в МойСклад. Возобновляемый: прогресс в write-state.json.
//   node write-back.mjs pilot  — записать 3 товара и проверить
//   node write-back.mjs        — записать всё
import console from "node:console";
import process from "node:process";
import { URL } from "node:url";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { msFetch } from "./lib.mjs";

const mode = process.argv[2] ?? "all";
const { siteNameFieldId, merged } = JSON.parse(
  readFileSync(new URL("./site-names.json", import.meta.url), "utf8"),
);
if (!siteNameFieldId) throw new Error("siteNameFieldId missing");

const statePath = new URL("./write-state.json", import.meta.url);
const doneIds = new Set(
  existsSync(statePath)
    ? (JSON.parse(readFileSync(statePath, "utf8")).doneIds ?? [])
    : [],
);

async function putName(product) {
  await msFetch(`entity/product/${product.id}`, {
    method: "PUT",
    body: JSON.stringify({
      attributes: [
        {
          meta: {
            href: `https://api.moysklad.ru/api/remap/1.2/entity/product/metadata/attributes/${siteNameFieldId}`,
            type: "attributemetadata",
            mediaType: "application/json",
          },
          value: product.siteName,
        },
      ],
    }),
  });
}

async function verify(id) {
  const product = await (await msFetch(`entity/product/${id}?limit=1`)).json();
  const attr = (product.attributes ?? []).find((a) => a.id === siteNameFieldId);
  return attr?.value ?? null;
}

if (mode === "pilot") {
  const sample = [
    merged[0],
    merged[Math.floor(merged.length / 2)],
    merged[merged.length - 1],
  ];
  for (const product of sample) {
    await putName(product);
    const value = await verify(product.id);
    const ok = value === product.siteName;
    console.log(`${ok ? "OK " : "FAIL"} ${product.id}`);
    console.log(`     было:  «${product.oldName}»`);
    console.log(`     стало: «${product.siteName}»`);
    console.log(`     чтение: «${value}»`);
  }
  process.exit(0);
}

let done = 0;
let failed = 0;
const started = Date.now();
const concurrency = 4;
let cursor = 0;

async function worker() {
  while (cursor < merged.length) {
    const product = merged[cursor++];
    if (doneIds.has(product.id)) continue;
    try {
      await putName(product);
      doneIds.add(product.id);
      done++;
    } catch (e) {
      failed++;
      console.error(`FAIL ${product.id} «${product.oldName}»: ${e.message}`);
    }
    if (done % 250 === 0) {
      writeFileSync(statePath, JSON.stringify({ doneIds: [...doneIds] }));
      const rate = done / ((Date.now() - started) / 1000);
      console.log(
        `${done}/${merged.length} (failed: ${failed}), ${rate.toFixed(1)} шт/с, ETA ${Math.round((merged.length - done - failed) / Math.max(rate, 0.1) / 60)} мин`,
      );
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
writeFileSync(statePath, JSON.stringify({ doneIds: [...doneIds] }));
console.log(
  `Готово: записано ${done}, ошибок ${failed}, всего в состоянии ${doneIds.size}/${merged.length}`,
);

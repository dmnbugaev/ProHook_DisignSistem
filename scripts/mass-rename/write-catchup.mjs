// Запись «Названия для сайта» для догоняющего батча новых товаров (batch-17).
import console from "node:console";
import { URL } from "node:url";
import { readFileSync } from "node:fs";
import { msFetch } from "./lib.mjs";

const { siteNameFieldId } = JSON.parse(
  readFileSync(new URL("./site-names.json", import.meta.url), "utf8"),
);
const { names } = JSON.parse(
  readFileSync(new URL("./out/batch-17.json", import.meta.url), "utf8"),
);
const inventory = JSON.parse(
  readFileSync(new URL("./catchup-inventory.json", import.meta.url), "utf8"),
);
if (names.length !== inventory.length)
  throw new Error(
    `Покрытие: ${names.length} названий на ${inventory.length} товаров`,
  );
for (const n of names) {
  if (
    typeof n.siteName !== "string" ||
    !n.siteName.trim() ||
    n.siteName.length > 200
  )
    throw new Error(`Плохая запись i=${n.i}: «${n.siteName}»`);
}

let done = 0;
let failed = 0;
for (const entry of names) {
  const product = inventory[entry.i];
  try {
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
            value: entry.siteName,
          },
        ],
      }),
    });
    done++;
  } catch (e) {
    failed++;
    console.error(`FAIL ${product.id} «${product.name}»: ${e.message}`);
  }
}
console.log(`Готово: записано ${done}, ошибок ${failed}`);

// Создаёт строковый атрибут «Название для сайта» на товарах.
// Сайт (server/services/moysklad.ts) ищет поле по точному имени — не переименовывать.
import console from "node:console";
import process from "node:process";
import { msFetch } from "./lib.mjs";

const existing = await (
  await msFetch("entity/product/metadata/attributes?limit=100")
).json();
const found = existing.rows.find(
  (a) => a.name.trim().toLocaleLowerCase("ru") === "название для сайта",
);
if (found) {
  console.log(`Already exists: ${found.id} (${found.name}, ${found.type})`);
  process.exit(0);
}

const created = await (
  await msFetch("entity/product/metadata/attributes", {
    method: "POST",
    body: JSON.stringify({
      name: "Название для сайта",
      type: "string",
      description: "Полное наименование товара для витрины сайта ProHook",
      show: false,
    }),
  })
).json();
console.log(`Created: ${created.id} (${created.name}, ${created.type})`);

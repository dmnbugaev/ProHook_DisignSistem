// Делит инвентарь на батчи для генерации названий.
// Сортировка по папке, чтобы линейки одного бренда попадали в один батч.
import console from "node:console";
import { URL } from "node:url";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const BATCH_SIZE = 400;

const { inventory } = JSON.parse(
  readFileSync(new URL("./products-backup.json", import.meta.url), "utf8"),
);
const sorted = [...inventory].sort(
  (a, b) =>
    a.folder.localeCompare(b.folder, "ru") ||
    a.name.localeCompare(b.name, "ru"),
);

mkdirSync(new URL("./batches", import.meta.url), { recursive: true });
mkdirSync(new URL("./out", import.meta.url), { recursive: true });

let batch = 0;
for (let offset = 0; offset < sorted.length; offset += BATCH_SIZE) {
  batch++;
  const lines = sorted.slice(offset, offset + BATCH_SIZE).map((p, index) => {
    const item = {
      i: index,
      name: p.name,
      folder: p.folder,
      article: p.article,
    };
    return JSON.stringify(item);
  });
  writeFileSync(
    new URL(
      `./batches/batch-${String(batch).padStart(2, "0")}.json`,
      import.meta.url,
    ),
    `{"batch":${batch},"items":[\n${lines.join(",\n")}\n]}\n`,
  );
}
console.log(`Products: ${sorted.length}, batches of ${BATCH_SIZE}: ${batch}`);

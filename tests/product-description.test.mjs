import { test } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { splitProductDescription } = await jiti.import(
  "../shared/utils/product.ts",
);

test("splitProductDescription separates compatibility paragraph", () => {
  // Живой формат МойСклад: описание, пустая строка, «Совместимость: …».
  const split = splitProductDescription(
    "Сменный испаритель на сетке.\n\nСовместимость: XROS 4, XROS 5.",
  );
  assert.equal(split.main, "Сменный испаритель на сетке.");
  assert.equal(split.compatibility, "XROS 4, XROS 5.");
});

test("marker at the start leaves no main text", () => {
  const split = splitProductDescription(
    "Совместимость: Drag S2, Drag X2.\nКартриджи - PnP X.",
  );
  assert.equal(split.main, "");
  assert.equal(split.compatibility, "Drag S2, Drag X2.\nКартриджи - PnP X.");
});

test("description without marker stays whole", () => {
  const split = splitProductDescription(
    "Высокотоковые аккумуляторы формата 18650.",
  );
  assert.equal(split.main, "Высокотоковые аккумуляторы формата 18650.");
  assert.equal(split.compatibility, null);
});

test("marker is not detected mid-sentence", () => {
  const split = splitProductDescription(
    "Подходит ко всем базам; совместимость: уточняйте у продавца.",
  );
  assert.equal(
    split.main,
    "Подходит ко всем базам; совместимость: уточняйте у продавца.",
  );
  assert.equal(split.compatibility, null);
});

test("surrounding whitespace and empty compatibility", () => {
  const split = splitProductDescription(
    "  Текст.  \n\n  Совместимость:   \n  Vaporesso XROS.  ",
  );
  assert.equal(split.main, "Текст.");
  assert.equal(split.compatibility, "Vaporesso XROS.");
  const empty = splitProductDescription("Текст.\n\nСовместимость:");
  assert.equal(empty.compatibility, null);
});

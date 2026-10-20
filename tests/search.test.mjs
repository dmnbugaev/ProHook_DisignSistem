import assert from "node:assert/strict";
import { test } from "node:test";
import { createJiti } from "jiti";

const {
  normalizeSearchText,
  tokenizeSearchQuery,
  switchLayout,
  transliterate,
  levenshtein,
  compileSearchDocument,
  matchSearchQuery,
} = await createJiti(import.meta.url).import("../shared/utils/search.ts");

test("normalizeSearchText: регистр, ё→е, пунктуация, пробелы", () => {
  assert.equal(
    normalizeSearchText("Тёмный Side-Shot 250г"),
    "темный side shot 250г",
  );
  assert.equal(normalizeSearchText("  ElfBar   PRO  "), "elfbar pro");
  assert.equal(normalizeSearchText(""), "");
});

test("tokenizeSearchQuery разбивает на нормализованные токены", () => {
  assert.deepEqual(tokenizeSearchQuery("Блокнот А5, синий"), [
    "блокнот",
    "а5",
    "синий",
  ]);
  assert.deepEqual(tokenizeSearchQuery("   "), []);
});

test("switchLayout: латиница→русский и обратно (ЙЦУКЕН)", () => {
  assert.equal(switchLayout("ghbdtn"), "привет");
  assert.equal(switchLayout("привет"), "ghbdtn");
  assert.equal(switchLayout("vjycnh"), "монстр");
  assert.equal(switchLayout("test"), "еуые");
  // Буквы б/ю живут на клавишах «,»/«.» — нормализация их вырезает,
  // такой запрос («блокнот» → «,kjryjn» → «kjryjn») добирается скелетом
  // и опечаточным допуском (см. тест умного поиска).
  assert.equal(switchLayout("kjryjn"), "локнот");
});

test("transliterate: русский → латиница", () => {
  assert.equal(transliterate("дарксайд"), "darksayd");
  // Буквальное «darksayd» ≠ «darkside»: мостик — согласный скелет
  // (drksd == drksd), см. тест умного поиска.
  assert.equal(transliterate("эльфбар"), "elfbar");
  assert.equal(transliterate("хука"), "khuka");
  assert.equal(transliterate("elfbar"), null);
});

test("levenshtein: замены, вставки, удаления", () => {
  assert.equal(levenshtein("блокнот", "блокнот"), 0);
  assert.equal(levenshtein("блакнот", "блокнот"), 1);
  assert.equal(levenshtein("блокнотс", "блокнот"), 1);
  assert.equal(levenshtein("блокнты", "блокнот"), 2);
  assert.equal(levenshtein("darkside", "darksides"), 1);
  assert.equal(levenshtein("", "абв"), 3);
});

const doc = compileSearchDocument({
  name: "DarkSide Shot Medium 10 г",
  categoryName: "Табак для кальяна",
  sku: "00012345",
});

test("умный поиск: транслит, раскладка, опечатки", () => {
  // Прямое совпадение по названию.
  assert.notEqual(matchSearchQuery(["darkside"], doc), null);
  // Русский запрос к латинскому бренду — через транслитерацию.
  assert.notEqual(matchSearchQuery(["дарксайд"], doc), null);
  // Латинский запрос к русскому слову — транслит слова документа.
  const russianDoc = compileSearchDocument({
    name: "Блокнот бумажный А5",
    categoryName: "Другое",
    sku: "42",
  });
  assert.notEqual(matchSearchQuery(["bumazhnyi"], russianDoc), null);
  // Запрос в неправильной раскладке («блокнот», набранный латиницей,
  // после нормализации — «kjryjn»).
  assert.notEqual(matchSearchQuery(["kjryjn"], russianDoc), null);
  // Опечатка в длинном слове.
  assert.notEqual(matchSearchQuery(["блокнто"], russianDoc), null);
  assert.notEqual(matchSearchQuery(["darksid"], doc), null);
});

test("каждое слово запроса обязано совпасть (AND), иначе null", () => {
  assert.notEqual(matchSearchQuery(["darkside", "medium"], doc), null);
  assert.equal(matchSearchQuery(["darkside", "картошка"], doc), null);
  // Категория тоже участвует в матчинге.
  assert.notEqual(matchSearchQuery(["табак", "кальяна"], doc), null);
  // Артикул.
  assert.notEqual(matchSearchQuery(["00012345"], doc), null);
  assert.notEqual(matchSearchQuery(["12345"], doc), null);
});

test("скоринг: точное слово и префикс названия выше substring и опечаток", () => {
  const exact = matchSearchQuery(["medium"], doc);
  const substring = matchSearchQuery(["dium"], doc);
  // Опечатка в согласной — идёт по нечёткому пути (гласные опечатки
  // попадают на совпадение скелета и оцениваются выше substring).
  const fuzzy = matchSearchQuery(["mesium"], doc);
  const category = matchSearchQuery(["кальяна"], doc);
  assert.ok(exact > substring, "точное слово > substring");
  assert.ok(substring > fuzzy, "substring > опечатка");
  assert.ok(fuzzy > category, "опечатка в названии > совпадение в категории");
  // Фразовый бонус: запрос — начало названия, а не слово в середине.
  const prefix = compileSearchDocument({
    name: "Блокнот А5",
    categoryName: "Другое",
    sku: "1",
  });
  const middle = compileSearchDocument({
    name: "Красный блокнот А5",
    categoryName: "Другое",
    sku: "1",
  });
  assert.ok(
    matchSearchQuery(["блокнот"], prefix) >
      matchSearchQuery(["блокнот"], middle),
    "начало названия > слово в середине",
  );
});

test("пустой запрос матчит всё со скором 0", () => {
  assert.equal(matchSearchQuery([], doc), 0);
});

test("хрупкие случаи не дают ложных срабатываний", () => {
  // Короткий токен без бюджетов на опечатки.
  assert.equal(matchSearchQuery(["ai"], doc), null);
  // Несвязанное слово.
  assert.equal(matchSearchQuery(["энергетик"], doc), null);
});

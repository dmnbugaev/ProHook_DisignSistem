/**
 * Умный поиск по каталогу: нормализация (регистр, ё→е, пунктуация),
 * устойчивость к опечаткам (Левенштейн с порогом по длине слова),
 * переключённой раскладке (ЙЦУКЕН) и транслитерации («дарксайд» ≈
 * «darkside»). Общие чистые функции без зависимостей — используются
 * серверным репозиторием каталога.
 */

/** Нормализация текста для поиска: регистр, ё→е, только буквы/цифры. */
export function normalizeSearchText(text: string): string {
  return text
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Разбор запроса на нормализованные токены (пустой запрос → []). */
export function tokenizeSearchQuery(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return normalized ? normalized.split(" ") : [];
}

/** Раскладка ЙЦУКЕН: латинская клавиша → русская буква. */
const EN_TO_RU: Record<string, string> = {
  q: "й",
  w: "ц",
  e: "у",
  r: "к",
  t: "е",
  y: "н",
  u: "г",
  i: "ш",
  o: "щ",
  p: "з",
  a: "ф",
  s: "ы",
  d: "в",
  f: "а",
  g: "п",
  h: "р",
  j: "о",
  k: "л",
  l: "д",
  z: "я",
  x: "ч",
  c: "с",
  v: "м",
  b: "и",
  n: "т",
  m: "ь",
};
const RU_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_RU).map(([en, ru]) => [ru, en]),
);

/**
 * Слово, набранное в другой раскладке: «ghbdtn» → «привет». Цифры не
 * переводятся. Ограничение: буквы б/ю живут на клавишах запятой/точки и
 * нормализацией вырезаются — такие запросы добираются опечаточным допуском.
 */
export function switchLayout(token: string): string | null {
  if (!/^[a-z0-9]+$/.test(token) && !/^[а-я0-9]+$/.test(token)) return null;
  const map = /^[a-z0-9]+$/.test(token) ? EN_TO_RU : RU_TO_EN;
  let result = "";
  for (const char of token) result += map[char] ?? char;
  return result === token ? null : result;
}

/** Транслитерация русского слова латиницей: «дарксайд» → «darksayd». */
const TRANSLIT_RU_TO_EN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

export function transliterate(word: string): string | null {
  if (!/^[а-я0-9]+$/.test(word)) return null;
  let result = "";
  for (const char of word) result += TRANSLIT_RU_TO_EN[char] ?? char;
  return result || null;
}

/**
 * Согласный скелет латинского слова (гласные вырезаются): фонетическое
 * сравнение транслитераций — «дарксайд» → drksd ≈ «darkside» → drksd.
 * Скелеты короче трёх знаков слишком шумные и не сравниваются.
 */
const MIN_SKELETON = 3;

export function consonantSkeleton(latinWord: string): string | null {
  const skeleton = latinWord.replace(/[aeiouy]/g, "");
  return skeleton.length >= MIN_SKELETON ? skeleton : null;
}

/** Допустимое редакционное расстояние для опечаток: 4–6 символов → 1, 7+ → 2. */
function typoBudget(word: string): number {
  if (word.length < 4) return 0;
  return word.length <= 6 ? 1 : 2;
}

/** Расстояние Левенштейна (двухстрочный DP — слова короткие). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1]! + 1,
        previous[j]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** Слово документа во всех сравнимых формах. */
interface CompiledWord {
  /** Само слово (нормализованное). */
  base: string;
  /** Транслит (для русских слов) — латинские запросы к русским брендам. */
  translit: string | null;
  /** Согласный скелет — фонетические совпадения транслита. */
  skeleton: string | null;
}

function compileWord(word: string): CompiledWord {
  const translit = transliterate(word);
  return {
    base: word,
    translit,
    skeleton: consonantSkeleton(translit ?? word),
  };
}

export interface CompiledSearchDocument {
  name: string;
  nameWords: CompiledWord[];
  category: string;
  categoryWords: CompiledWord[];
  sku: string;
}

function compileWords(text: string): CompiledWord[] {
  const normalized = normalizeSearchText(text);
  if (!normalized) return [];
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((word) => compileWord(word));
}

/** Компиляция документа поиска один раз на товар (кэшируется репозиторием). */
export function compileSearchDocument(product: {
  name: string;
  categoryName?: string | null;
  sku: string;
}): CompiledSearchDocument {
  return {
    name: normalizeSearchText(product.name),
    nameWords: compileWords(product.name),
    category: normalizeSearchText(product.categoryName ?? ""),
    categoryWords: compileWords(product.categoryName ?? ""),
    sku: normalizeSearchText(product.sku),
  };
}

// Веса совпадений: больше — релевантнее.
const SCORE_NAME_EXACT_WORD = 100;
const SCORE_NAME_WORD_STARTS = 70;
const SCORE_NAME_SKELETON = 60;
const SCORE_NAME_SUBSTRING = 50;
const SCORE_NAME_FUZZY = 25;
const SCORE_CATEGORY_WORD_STARTS = 18;
const SCORE_CATEGORY_SUBSTRING = 10;
const SCORE_SKU_EXACT = 16;
const SCORE_SKU_SUBSTRING = 8;

/** Формы токена для сравнения: сам токен, раскладка, транслит. */
function tokenVariants(token: string): string[] {
  const variants = [token];
  const switched = switchLayout(token);
  if (switched) variants.push(switched);
  for (const source of [token, switched ?? ""]) {
    const translit = transliterate(source);
    if (translit && !variants.includes(translit)) variants.push(translit);
  }
  return variants;
}

function wordTargets(word: CompiledWord): string[] {
  const targets = [word.base];
  if (word.translit) targets.push(word.translit);
  return targets;
}

interface FieldWeights {
  exact: number;
  starts: number;
  skeleton: number;
  substring: number;
  fuzzy: number;
}

function scoreTokenInField(
  tokens: string[],
  skeletons: Set<string>,
  field: string,
  words: CompiledWord[],
  weights: FieldWeights,
): number {
  const { exact, starts, skeleton, substring, fuzzy } = weights;
  // Совпадение с началом поля — самое сильное после точного слова.
  if (field && tokens.some((token) => field.startsWith(token)))
    return Math.max(exact, starts);
  let best = 0;
  for (const word of words) {
    const targets = wordTargets(word);
    if (tokens.some((token) => targets.includes(token))) return exact;
    if (
      best < starts &&
      tokens.some(
        (token) =>
          token.length >= 2 &&
          targets.some((target) => target.startsWith(token)),
      )
    )
      best = starts;
    if (best < skeleton && word.skeleton && skeletons.has(word.skeleton))
      best = skeleton;
    if (
      best < substring &&
      tokens.some((token) => targets.some((target) => target.includes(token)))
    )
      best = substring;
    if (best < fuzzy && fuzzy > 0 && variantsFuzzy(tokens, targets))
      best = fuzzy;
  }
  // Поля без слов (артикул) и «размазанные» совпадения по всей строке.
  if (
    best < substring &&
    field &&
    tokens.some((token) => field.includes(token))
  )
    best = substring;
  return best;
}

function variantsFuzzy(tokens: string[], targets: string[]): boolean {
  const budget = Math.max(...tokens.map((token) => typoBudget(token)));
  if (budget <= 0) return false;
  return tokens.some((token) =>
    targets.some(
      (target) =>
        Math.abs(target.length - token.length) <= budget &&
        levenshtein(token, target) <= budget,
    ),
  );
}

/**
 * Скоринг запроса по документу: каждое слово запроса должно совпасть хотя бы
 * с одним полем (название/категория/артикул), иначе null. Больше — релевантнее.
 */
export function matchSearchQuery(
  tokens: string[],
  document: CompiledSearchDocument,
): number | null {
  if (!tokens.length) return 0;
  let total = 0;
  for (const token of tokens) {
    const variants = tokenVariants(token);
    const skeletons = new Set(
      variants
        .map((variant) => consonantSkeleton(variant))
        .filter((skeleton): skeleton is string => skeleton !== null),
    );
    const score = Math.max(
      scoreTokenInField(
        variants,
        skeletons,
        document.name,
        document.nameWords,
        {
          exact: SCORE_NAME_EXACT_WORD,
          starts: SCORE_NAME_WORD_STARTS,
          skeleton: SCORE_NAME_SKELETON,
          substring: SCORE_NAME_SUBSTRING,
          fuzzy: SCORE_NAME_FUZZY,
        },
      ),
      scoreTokenInField(
        variants,
        skeletons,
        document.category,
        document.categoryWords,
        {
          exact: SCORE_CATEGORY_WORD_STARTS,
          starts: SCORE_CATEGORY_WORD_STARTS,
          skeleton: SCORE_CATEGORY_SUBSTRING,
          substring: SCORE_CATEGORY_SUBSTRING,
          fuzzy: 0,
        },
      ),
      scoreTokenInField(variants, skeletons, document.sku, [], {
        exact: SCORE_SKU_EXACT,
        starts: SCORE_SKU_EXACT,
        skeleton: 0,
        substring: SCORE_SKU_SUBSTRING,
        fuzzy: 0,
      }),
    );
    if (score <= 0) return null;
    total += score;
  }
  // Фразовый бонус: запрос целиком — начало названия.
  const phrase = tokens.join(" ");
  if (document.name.startsWith(phrase)) total += 30;
  return total;
}

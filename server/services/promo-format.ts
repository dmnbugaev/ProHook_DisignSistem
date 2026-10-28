/**
 * Разбор форматирования Telegram для карточек промо-акций: сущности
 * (entities) апдейта превращаются в безопасный HTML, и блок акций на сайте
 * показывает сообщение «как в Телеграме» — жирный, курсив, подчёркивание,
 * зачёркивание, цитаты (в том числе многострочные), моноширинный текст,
 * ссылки, спойлеры, переносы строк и отступы.
 *
 * Безопасность: готовый HTML из Telegram не приходит никогда — теги
 * генерирует только этот модуль из allowlist, весь текст экранируется.
 * sanitizePromoHtml дополнительно прогоняет результат на входе в хранилище
 * (защита от испорченных данных в promos.json).
 */

export interface TelegramMessageEntity {
  /** Позиция и длина в UTF-16 кодовых единицах — совпадают с индексами JS. */
  offset: number;
  length: number;
  type: string;
  /** Адрес ссылки для сущности text_link. */
  url?: string;
}

export interface CleanPromoText {
  text: string;
  entities: TelegramMessageEntity[];
}

/**
 * Невидимые и управляющие символы (анти-спуфинг, как в normalizeText
 * хранилища): C0 кроме \n и \t, DEL, разделители строк/абзацев, нулевая
 * ширина, bidi-управление. \n и \t остаются — их показывает white-space:
 * pre-wrap на сайте.
 */
function isUnsafeChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    code <= 0x08 ||
    (code >= 0x0b && code <= 0x1f) ||
    code === 0x7f ||
    (code >= 0x200b && code <= 0x200f) ||
    code === 0x2028 ||
    code === 0x2029 ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x2064) ||
    (code >= 0x2066 && code <= 0x2069) ||
    code === 0xfeff
  );
}

function hasUnsafeChar(text: string): boolean {
  for (const char of text) if (isUnsafeChar(char)) return true;
  return false;
}

/** Теги разметки, которые модуль умеет генерировать. */
const TAG_BY_TYPE: Record<string, string> = {
  bold: "strong",
  italic: "em",
  underline: "u",
  strikethrough: "s",
  code: "code",
  pre: "pre",
  blockquote: "blockquote",
  expandable_blockquote: "blockquote",
  spoiler: "span",
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function httpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Отбрасывание сущностей с невалидными offset/length под данную строку. */
function validEntities(
  text: string,
  entities: TelegramMessageEntity[],
): TelegramMessageEntity[] {
  return entities.filter(
    (entity) =>
      Number.isInteger(entity.offset) &&
      Number.isInteger(entity.length) &&
      entity.offset >= 0 &&
      entity.length > 0 &&
      entity.offset + entity.length <= text.length,
  );
}

/**
 * Чистка исходного сообщения с пересчётом offset'ов сущностей: вырезанные
 * символы сдвигают текст, поэтому строится карта «позиция в raw → позиция
 * в чистом тексте». Сущности, целиком попавшие в вырезанное, исчезают.
 */
export function cleanTelegramText(
  raw: string,
  entities: TelegramMessageEntity[] = [],
): CleanPromoText {
  const valid = validEntities(raw, entities);
  if (!hasUnsafeChar(raw)) return { text: raw, entities: valid };

  let text = "";
  // rawToKept[i] — позиция в чистом тексте ПЕРЕД raw[i]; последний элемент — длина.
  const rawToKept: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    rawToKept.push(text.length);
    const char = raw.charAt(i);
    if (!isUnsafeChar(char)) text += char;
  }
  rawToKept.push(text.length);

  const cleaned: TelegramMessageEntity[] = [];
  for (const entity of valid) {
    const offset = rawToKept[Math.min(entity.offset, rawToKept.length - 1)]!;
    const end =
      rawToKept[Math.min(entity.offset + entity.length, rawToKept.length - 1)]!;
    if (end > offset) cleaned.push({ ...entity, offset, length: end - offset });
  }
  return { text, entities: cleaned };
}

/** Срез сущностей под диапазон [start, end): offsets становятся относительными. */
export function clipEntities(
  entities: TelegramMessageEntity[],
  start: number,
  end: number,
): TelegramMessageEntity[] {
  const clipped: TelegramMessageEntity[] = [];
  for (const entity of entities) {
    const from = Math.max(entity.offset, start);
    const to = Math.min(entity.offset + entity.length, end);
    if (to > from)
      clipped.push({ ...entity, offset: from - start, length: to - from });
  }
  return clipped;
}

/** Подстрока [start, end) вместе с пересчитанными сущностями. */
export function sliceWithEntities(
  text: string,
  entities: TelegramMessageEntity[],
  start: number,
  end: number,
): CleanPromoText {
  return {
    text: text.slice(start, end),
    entities: clipEntities(entities, start, end),
  };
}

/** trim() по краям с сохранением сущностей внутри. */
export function trimWithEntities(clean: CleanPromoText): CleanPromoText {
  const start = clean.text.length - clean.text.trimStart().length;
  const end = clean.text.trimEnd().length;
  if (start === 0 && end === clean.text.length) return clean;
  return sliceWithEntities(clean.text, clean.entities, start, end);
}

/**
 * Обрезка до лимита символов с клипом сущностей: закрытые теги остаются
 * парными, потому что HTML генерируется уже после обрезки. Суррогатную пару
 * на границе не рвём — уводим границу на кодовую единицу назад.
 */
export function truncateForPromo(
  clean: CleanPromoText,
  max: number,
): CleanPromoText {
  if (max <= 0) return { text: "", entities: [] };
  if (clean.text.length <= max) return clean;
  let cut = max;
  const before = clean.text.charCodeAt(max - 1);
  const after = clean.text.charCodeAt(max);
  if (
    before >= 0xd800 &&
    before <= 0xdbff &&
    after >= 0xdc00 &&
    after <= 0xdfff
  )
    cut = max - 1;
  return sliceWithEntities(clean.text, clean.entities, 0, cut);
}

function entityTag(
  entity: TelegramMessageEntity,
  plain: string,
  inner: string,
): string {
  if (entity.type === "text_link") {
    const href = httpsUrl(entity.url);
    return href
      ? `<a href="${escapeHtml(href)}" rel="noopener">${inner}</a>`
      : inner;
  }
  if (entity.type === "url") {
    const href = httpsUrl(plain.trim());
    return href
      ? `<a href="${escapeHtml(href)}" rel="noopener">${inner}</a>`
      : inner;
  }
  const tag = TAG_BY_TYPE[entity.type];
  if (!tag) return inner;
  if (tag === "span") return `<span class="tg-spoiler">${inner}</span>`;
  return `<${tag}>${inner}</${tag}>`;
}

/**
 * Ценник в тексте акции: «490 ₽», «1 490 руб.», «350р», «690 рублей» —
 * оборачивается в .tg-price, сайт красит его красным (решение владельца
 * 29.10.2026). Подсветка ставится только вне code/pre: моноширинные блоки —
 * технический текст, не ценник.
 */
const PRICE_RE =
  /(\d[\d\u00A0 ]*(?:[.,]\d+)?)\s*(₽|руб(?:ля|лей)?|р)\.?(?![а-яёa-z])/gi;

function emitText(segment: string, plainText: boolean): string {
  if (plainText) return escapeHtml(segment);
  let out = "";
  let cursor = 0;
  for (const match of segment.matchAll(PRICE_RE)) {
    const start = match.index ?? 0;
    out += escapeHtml(segment.slice(cursor, start));
    out += `<span class="tg-price">${escapeHtml(match[0])}</span>`;
    cursor = start + match[0].length;
  }
  return out + escapeHtml(segment.slice(cursor));
}

/**
 * Сущности → HTML. Вложенность рекурсивная; частично пересекающиеся
 * сущности (Telegram их не присылает, но на случай битых данных)
 * пропускаются. Неизвестные типы (mention, custom_emoji, hashtag…)
 * рендерятся как обычный текст.
 */
export function telegramTextToHtml(
  text: string,
  entities: TelegramMessageEntity[],
): string {
  const sorted = validEntities(text, entities)
    .slice()
    .sort((a, b) => a.offset - b.offset || b.length - a.length);
  let index = 0;

  function renderRange(start: number, end: number, plainText: boolean): string {
    let out = "";
    let cursor = start;
    while (index < sorted.length) {
      const entity = sorted[index]!;
      if (entity.offset >= end) break;
      if (entity.offset < cursor) {
        // пересекается с уже обработанной сущностью — пропускаем
        index++;
        continue;
      }
      out += emitText(text.slice(cursor, entity.offset), plainText);
      index++;
      const entityEnd = Math.min(entity.offset + entity.length, end);
      const tag = TAG_BY_TYPE[entity.type];
      const inner = renderRange(
        entity.offset,
        entityEnd,
        plainText || tag === "code" || tag === "pre",
      );
      out += entityTag(entity, text.slice(entity.offset, entityEnd), inner);
      cursor = entityEnd;
    }
    return out + emitText(text.slice(cursor, end), plainText);
  }

  return renderRange(0, text.length, false);
}

const SANITIZE_TAG_RE =
  /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/;
const SANITIZE_ALLOWED = new Set([
  "strong",
  "em",
  "u",
  "s",
  "code",
  "pre",
  "blockquote",
  "a",
  "span",
]);

/**
 * Защитный фильтр на входе в хранилище: блоки script/style вырезаются целиком
 * вместе с содержимым, из остальных тегов остаются только теги allowlist;
 * у <a> — только https- href + rel, у <span> — только класс tg-spoiler.
 * Остальные теги и атрибуты вырезаются.
 */
export function sanitizePromoHtml(html: string): string {
  const withoutBlocks = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<style\b[^>]*>/gi, "");
  return withoutBlocks.replace(
    new RegExp(SANITIZE_TAG_RE.source, "g"),
    (full, slash: string, rawTag: string, attrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!SANITIZE_ALLOWED.has(tag)) return "";
      if (tag === "a" && !slash) {
        const match = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
        const href = httpsUrl(match?.[1] ?? match?.[2]);
        return href ? `<a href="${escapeHtml(href)}" rel="noopener">` : "<a>";
      }
      if (tag === "span" && !slash) {
        const classes = (/class\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? "")
          .split(/\s+/)
          .filter((cls) => cls === "tg-spoiler" || cls === "tg-price");
        return classes.length
          ? `<span class="${classes.join(" ")}">`
          : "<span>";
      }
      return `<${slash}${tag}>`;
    },
  );
}

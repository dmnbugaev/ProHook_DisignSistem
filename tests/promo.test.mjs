import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { createJiti } from "jiti";

/**
 * Тесты бота промо-акций: парсер команд, хранилище карточек, обработка
 * апдейтов. Живой Telegram не используется — fetch подменён, ключи тестовые;
 * никаких уведомлений наружу не уходит (инвариант: тесты молчат).
 */

process.env.PROMO_DATA_DIR = mkdtempSync(join(tmpdir(), "prohook-promo-"));
process.env.TELEGRAM_PROMO_BOT_TOKEN = "test-promo-token";
process.env.TELEGRAM_PROMO_CHAT_IDS = "6939112736,1107248048";
process.env.PROMO_SEED_DEMO = "0";

const jiti = createJiti(import.meta.url);
const {
  createPromo,
  deletePromo,
  listActivePromos,
  listPromos,
  pinPromo,
  resetPromoStoreForTests,
  seedDemoPromosIfEmpty,
  setPromoStatus,
} = await jiti.import("../server/services/promo-store.ts");
const {
  handlePromoUpdateOnce,
  parsePromoBotCommand,
  parsePromoChatIds,
  resetPromoBotForTests,
} = await jiti.import("../server/services/promo-telegram.ts");
const {
  cleanTelegramText,
  sanitizePromoHtml,
  telegramTextToHtml,
  truncateForPromo,
} = await jiti.import("../server/services/promo-format.ts");

const originalFetch = globalThis.fetch;
const Response = globalThis.Response;
const sentMessages = [];
const pngBytes = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52,
]);
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes("sendMessage")) {
    sentMessages.push({
      url,
      chat_id: new URL(url).searchParams.get("chat_id"),
      text: new URL(url).searchParams.get("text"),
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  if (url.includes("getFile")) {
    // Путь файла зависит от file_id: фото, стикеры и эскизы к ним.
    const id = new URL(url).searchParams.get("file_id");
    const path =
      id === "sticker-file"
        ? "stickers/sticker.webp"
        : id === "sticker-video"
          ? "stickers/sticker.webm"
          : id === "thumb-file"
            ? "stickers/thumb.jpg"
            : "photos/card.png";
    return new Response(JSON.stringify({ result: { file_path: path } }), {
      status: 200,
    });
  }
  if (url.includes("/file/bot")) return new Response(pngBytes, { status: 200 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

beforeEach(() => {
  sentMessages.length = 0;
  // Файл живёт на всём процессе — чистим между тестами (кэш сбрасываем и
  // файл, иначе load() прочитает прошлый тест).
  rmSync(join(process.env.PROMO_DATA_DIR, "promos.json"), { force: true });
  resetPromoStoreForTests();
  resetPromoBotForTests();
});

after(() => {
  globalThis.fetch = originalFetch;
  rmSync(process.env.PROMO_DATA_DIR, { recursive: true, force: true });
});

const update = (text, chatId = 6939112736, updateId = 1) => ({
  update_id: updateId,
  message: { message_id: updateId, chat: { id: chatId }, text },
});

test("parsePromoChatIds: числа, дедупликация, лимит", () => {
  assert.deepEqual(parsePromoChatIds("6939112736, 1107248048"), [
    "6939112736",
    "1107248048",
  ]);
  assert.deepEqual(parsePromoChatIds("abc, 42,, -100200300"), [
    "42",
    "-100200300",
  ]);
  assert.equal(parsePromoChatIds(undefined).length, 0);
  const many = Array.from({ length: 30 }, (_, index) => index + 1).join(",");
  assert.equal(parsePromoChatIds(many).length, 20);
});

test("парсер команд: создание карточки из сообщения", () => {
  const command = parsePromoBotCommand(
    "−20% на чай\nТолько до воскресенья\n/catalog",
  );
  assert.equal(command.kind, "create");
  assert.equal(command.title, "−20% на чай");
  assert.equal(command.text, "Только до воскресенья");
  assert.equal(command.ctaHref, "/catalog");
});

test("парсер команд: https-ссылка, без ссылки, команды", () => {
  const https = parsePromoBotCommand("Заголовок\nhttps://прохук.рф/contacts");
  assert.equal(https.ctaHref, "https://прохук.рф/contacts");
  const plain = parsePromoBotCommand("Просто акция без ссылки");
  assert.equal(plain.ctaHref, null);
  assert.equal(plain.text, "");
  assert.equal(parsePromoBotCommand("/list").kind, "list");
  assert.equal(parsePromoBotCommand("/start").kind, "help");
  assert.deepEqual(parsePromoBotCommand("/off 3"), {
    kind: "status",
    status: "hidden",
    number: 3,
  });
  assert.deepEqual(parsePromoBotCommand("/del 12"), {
    kind: "delete",
    number: 12,
  });
  assert.deepEqual(parsePromoBotCommand("/pin 2"), {
    kind: "pin",
    number: 2,
  });
  // Без номера и неизвестные команды игнорируются.
  assert.equal(parsePromoBotCommand("/off").kind, "ignore");
  assert.equal(parsePromoBotCommand("/frobnicate 1").kind, "ignore");
  assert.equal(parsePromoBotCommand("").kind, "ignore");
});

test("хранилище: создание, публикация активных, скрытие и удаление", async () => {
  const first = await createPromo({ title: "Первая", ctaHref: "/catalog" });
  const second = await createPromo({ title: "Вторая" });
  assert.equal(first.number, 1);
  assert.equal(second.number, 2);
  let active = await listActivePromos();
  assert.equal(active.length, 2);
  // Новые карточки показываются первыми.
  assert.equal(active[0].title, "Вторая");
  assert.equal(active[0].accent, "yellow");
  assert.equal(active[1].title, "Первая");
  assert.equal(active[1].ctaLabel, "Открыть");
  assert.equal(active[1].accent, "ink");

  await setPromoStatus(2, "hidden");
  active = await listActivePromos();
  assert.equal(active.length, 1);
  assert.equal(active[0].title, "Первая");

  await setPromoStatus(2, "active");
  assert.equal((await listActivePromos()).length, 2);

  assert.equal(await deletePromo(1), true);
  assert.equal(await deletePromo(99), false);
  assert.equal((await listPromos()).length, 1);
});

test("хранилище: /pin переставляет карточку в начало ленты", async () => {
  await createPromo({ title: "А" });
  await createPromo({ title: "Б" });
  await createPromo({ title: "В" });
  await pinPromo(2);
  const active = await listActivePromos();
  assert.deepEqual(
    active.map((item) => item.title),
    ["Б", "В", "А"],
  );
});

test("демо-сид только при PROMO_SEED_DEMO=1 и только в пустой каталог", async () => {
  await seedDemoPromosIfEmpty();
  assert.equal((await listPromos()).length, 0);
  process.env.PROMO_SEED_DEMO = "1";
  await seedDemoPromosIfEmpty();
  assert.equal((await listPromos()).length, 3);
  await seedDemoPromosIfEmpty();
  assert.equal((await listPromos()).length, 3);
  process.env.PROMO_SEED_DEMO = "0";
});

test("демо-сид не дублируется при параллельных вызовах на пустом каталоге", async () => {
  // Регрессия e2e: несколько GET /api/promos на старте concurrently видели
  // «пусто» и накатывали по 3 карточки — в изолированном хранилище
  // оказывалось 9 с повторами заголовков, карусель меняла карточки
  // без смены заголовка.
  process.env.PROMO_SEED_DEMO = "1";
  await Promise.all(Array.from({ length: 5 }, () => seedDemoPromosIfEmpty()));
  const promos = await listPromos();
  assert.equal(promos.length, 3);
  assert.equal(new Set(promos.map((item) => item.title)).size, 3);
  process.env.PROMO_SEED_DEMO = "0";
});

test("апдейты: создание карточки, ответы оператору, allowlist", async () => {
  await handlePromoUpdateOnce(update("Ночная скидка\nС 22:00\n/catalog"));
  let active = await listActivePromos();
  assert.equal(active.length, 1);
  assert.equal(active[0].title, "Ночная скидка");
  // Ответ ушёл в чат оператора.
  assert.equal(sentMessages.length, 1);

  // Чужой чат игнорируется полностью — ни карточки, ни ответа.
  await handlePromoUpdateOnce(update("Спам", 42424242, 2));
  assert.equal((await listActivePromos()).length, 1);
  assert.equal(sentMessages.length, 1);

  // Повтор того же апдейта (retry вебхука) не дублирует карточку.
  await handlePromoUpdateOnce(update("Ночная скидка\nС 22:00\n/catalog"));
  active = await listActivePromos();
  assert.equal(active.length, 1);

  // Команды управления.
  await handlePromoUpdateOnce(update("/off 1", 6939112736, 3));
  assert.equal((await listActivePromos()).length, 0);
  await handlePromoUpdateOnce(update("/list", 1107248048, 4));
  assert.ok(
    sentMessages.at(-1).chat_id === "1107248048",
    "ответ ушёл второму оператору",
  );
});

test("апдейты: обычный текст от команд с пробелами не путается", async () => {
  // Строка «/del 3» внутри текста карточки не становится ссылкой-кнопкой.
  await handlePromoUpdateOnce(
    update("Заголовок акции\nТекст со строкой\n/del 3", 6939112736, 10),
  );
  const active = await listActivePromos();
  assert.equal(active.length, 1);
  assert.equal(active[0].ctaHref, null);
});

test("лента: акценты чередуются по позиции даже после удалений", async () => {
  await createPromo({ title: "А" });
  await createPromo({ title: "Б" });
  await createPromo({ title: "В" });
  await createPromo({ title: "Г" });
  // Убираем две средние — жёлтая/тёмная чередуется без «дыр».
  await deletePromo(3);
  await deletePromo(2);
  const active = await listActivePromos();
  assert.deepEqual(
    active.map((item) => item.accent),
    ["yellow", "ink"],
  );
});

test("апдейты: фото с подписью скачивается, /del удаляет и файл", async () => {
  const mediaDir = join(process.env.PROMO_DATA_DIR, "media");
  await handlePromoUpdateOnce({
    update_id: 20,
    message: {
      message_id: 20,
      chat: { id: 6939112736 },
      caption: "Акция с фото\nТекст",
      photo: [{ file_id: "photo-file-id" }],
    },
  });
  let [promo] = await listPromos();
  assert.ok(promo.mediaFile?.endsWith(".png"), "фото скачано в media-каталог");
  assert.ok(existsSync(join(mediaDir, promo.mediaFile)));
  // Публичный контракт отдаёт URL изображения карточки.
  assert.equal(
    (await listActivePromos())[0].image,
    `/api/promos/${promo.id}/image`,
  );

  await handlePromoUpdateOnce(update("/del " + promo.number, 6939112736, 21));
  [promo] = await listPromos();
  assert.equal(promo, undefined);
  assert.equal(
    readdirSync(mediaDir).length,
    0,
    "файл изображения удалён вместе с карточкой",
  );
});

test("апдейты: фото без подписи получает подсказку, карточки нет", async () => {
  await handlePromoUpdateOnce({
    update_id: 30,
    message: {
      message_id: 30,
      chat: { id: 6939112736 },
      photo: [{ file_id: "photo-file-id" }],
    },
  });
  assert.equal((await listPromos()).length, 0);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /нет подписи/);
});

test("формат: ценники подсвечиваются классом tg-price", () => {
  assert.equal(
    telegramTextToHtml("Чай за 490 ₽", []),
    'Чай за <span class="tg-price">490 ₽</span>',
  );
  assert.equal(
    telegramTextToHtml("1 490 руб.", []),
    '<span class="tg-price">1 490 руб.</span>',
  );
  assert.equal(
    telegramTextToHtml("всего 350р", []),
    'всего <span class="tg-price">350р</span>',
  );
  assert.equal(
    telegramTextToHtml("690 рублей со скидкой", []),
    '<span class="tg-price">690 рублей</span> со скидкой',
  );
  // Не ценник: после «р» идёт слово, обычные числа без валюты.
  assert.equal(
    telegramTextToHtml("рейс 3 раз, рост 12", []),
    "рейс 3 раз, рост 12",
  );
  // Внутри code/pre подсветки нет — это моноширинный технический текст.
  assert.equal(
    telegramTextToHtml("код 490 ₽", [{ offset: 0, length: 9, type: "pre" }]),
    "<pre>код 490 ₽</pre>",
  );
  // Санитайзер сохраняет класс tg-price у span.
  assert.equal(
    sanitizePromoHtml('<span class="tg-price">490 ₽</span>'),
    '<span class="tg-price">490 ₽</span>',
  );
});

test("формат: сущности Telegram → безопасный HTML", () => {
  assert.equal(telegramTextToHtml("Просто текст", []), "Просто текст");
  assert.equal(
    telegramTextToHtml("Скидка на чай", [
      { offset: 0, length: 6, type: "bold" },
    ]),
    "<strong>Скидка</strong> на чай",
  );
  // Вложенность: жирный внутри курсива.
  assert.equal(
    telegramTextToHtml("Очень выгодно", [
      { offset: 0, length: 13, type: "italic" },
      { offset: 6, length: 7, type: "bold" },
    ]),
    "<em>Очень <strong>выгодно</strong></em>",
  );
  // Многострочная цитата: перенос строки живёт внутри blockquote.
  assert.equal(
    telegramTextToHtml("строка 1\nстрока 2", [
      { offset: 0, length: 17, type: "blockquote" },
    ]),
    "<blockquote>строка 1\nстрока 2</blockquote>",
  );
  assert.equal(
    telegramTextToHtml("сайт", [
      { offset: 0, length: 4, type: "text_link", url: "https://прохук.рф/x" },
    ]),
    // href нормализуется в punycode, как канонический домен сайта.
    '<a href="https://xn--j1ahceql.xn--p1ai/x" rel="noopener">сайт</a>',
  );
  // Только https: http-ссылка рендерится обычным текстом.
  assert.equal(
    telegramTextToHtml("сайт", [
      { offset: 0, length: 4, type: "text_link", url: "http://example.com" },
    ]),
    "сайт",
  );
  assert.equal(
    telegramTextToHtml("смотри https://прохук.рф/x", [
      { offset: 7, length: 19, type: "url" },
    ]),
    'смотри <a href="https://xn--j1ahceql.xn--p1ai/x" rel="noopener">https://прохук.рф/x</a>',
  );
  assert.equal(
    telegramTextToHtml("спойлер", [{ offset: 0, length: 7, type: "spoiler" }]),
    '<span class="tg-spoiler">спойлер</span>',
  );
  // Эмодзи — суррогатные пары: offset/length в UTF-16 кодовых единицах.
  assert.equal(
    telegramTextToHtml("🔥🔥 скидка", [{ offset: 0, length: 4, type: "bold" }]),
    "<strong>🔥🔥</strong> скидка",
  );
  // Текст экранируется.
  assert.equal(
    telegramTextToHtml("a<b>&\"'", []),
    "a&lt;b&gt;&amp;&quot;&#39;",
  );
});

test("формат: спуфинг-символы вырезаются, offset'ы пересчитываются", () => {
  // ZWSP (\u200B) и bidi-override (\u202E) вырезаны; сущность «ужалась»
  // вместе с текстом.
  const clean = cleanTelegramText("a\u200Bb\u202Ec", [
    { offset: 0, length: 5, type: "bold" },
  ]);
  assert.equal(clean.text, "abc");
  assert.deepEqual(clean.entities, [{ offset: 0, length: 3, type: "bold" }]);
  // \n и \t остаются — их показывает white-space: pre-wrap.
  const multiline = cleanTelegramText("строка 1\n\tстрока 2", []);
  assert.equal(multiline.text, "строка 1\n\tстрока 2");
});

test("формат: обрезка по лимиту не рвёт суррогатные пары и сущности", () => {
  const cut = truncateForPromo(
    {
      text: "abcdef",
      entities: [{ offset: 0, length: 6, type: "bold" }],
    },
    3,
  );
  assert.equal(cut.text, "abc");
  assert.deepEqual(cut.entities, [{ offset: 0, length: 3, type: "bold" }]);
  const pair = truncateForPromo({ text: "ab🔥c", entities: [] }, 3);
  assert.equal(pair.text, "ab");
});

test("формат: sanitizePromoHtml вырезает теги вне allowlist", () => {
  assert.equal(
    sanitizePromoHtml(
      '<strong>ок</strong><script>alert(1)</script><a href="javascript:x">зло</a>',
    ),
    "<strong>ок</strong><a>зло</a>",
  );
  assert.equal(
    sanitizePromoHtml(
      '<span class="tg-spoiler">?</span><span onclick="x">!</span>',
    ),
    '<span class="tg-spoiler">?</span><span>!</span>',
  );
});

test("парсер команд: разметка заголовка и текста из entities", () => {
  const command = parsePromoBotCommand("Жирная скидка\nТолько до воскресенья", [
    { offset: 0, length: 13, type: "bold" },
  ]);
  assert.equal(command.kind, "create");
  assert.equal(command.title, "Жирная скидка");
  assert.equal(command.titleHtml, "<strong>Жирная скидка</strong>");
  assert.equal(command.text, "Только до воскресенья");
  assert.equal(command.textHtml, "Только до воскресенья");
});

test("парсер команд: переносы строк, отступы и пустые строки сохраняются", () => {
  const command = parsePromoBotCommand(
    "Заголовок\nстрока 1\n  отступ\n\nпустая выше\n/catalog",
  );
  assert.equal(command.text, "строка 1\n  отступ\n\nпустая выше");
  assert.equal(command.ctaHref, "/catalog");
});

test("парсер команд: цитата в тексте и кнопка из text_link с подписью", () => {
  // "Акция\nТекст до\nЦитата": цитата — третья строка (offset 15).
  const quoted = parsePromoBotCommand("Акция\nТекст до\nЦитата", [
    { offset: 15, length: 6, type: "blockquote" },
  ]);
  assert.equal(quoted.textHtml, "Текст до\n<blockquote>Цитата</blockquote>");
  // Последняя строка целиком под text_link → кнопка с подписью из текста.
  const linked = parsePromoBotCommand("Акция\nТекст\nЖми сюда", [
    {
      offset: 12,
      length: 8,
      type: "text_link",
      url: "https://прохук.рф/catalog",
    },
  ]);
  assert.equal(linked.ctaHref, "https://прохук.рф/catalog");
  assert.equal(linked.ctaLabel, "Жми сюда");
  assert.equal(linked.text, "Текст");
});

test("апдейты: разметка сообщения доезжает до карточки и контракта", async () => {
  await handlePromoUpdateOnce({
    update_id: 40,
    message: {
      message_id: 40,
      chat: { id: 6939112736 },
      text: "Жирная акция\nОбычный текст\n<blockquote>подделка</blockquote>",
      entities: [{ offset: 0, length: 12, type: "bold" }],
    },
  });
  const [promo] = await listPromos();
  assert.equal(promo.titleHtml, "<strong>Жирная акция</strong>");
  // HTML в тексте сообщения — это текст, а не разметка: экранируется.
  assert.ok(promo.textHtml.includes("&lt;blockquote&gt;"));
  const [card] = await listActivePromos();
  assert.equal(card.titleHtml, "<strong>Жирная акция</strong>");
  assert.equal(card.mediaKind, "photo");
  assert.equal(card.imagePoster, null);
});

test("апдейты: статический стикер становится карточкой, /del чистит файлы", async () => {
  const mediaDir = join(process.env.PROMO_DATA_DIR, "media");
  await handlePromoUpdateOnce({
    update_id: 50,
    message: {
      message_id: 50,
      chat: { id: 6939112736 },
      sticker: {
        file_id: "sticker-file",
        thumbnail: { file_id: "thumb-file" },
      },
    },
  });
  const [promo] = await listPromos();
  assert.equal(promo.title, "");
  assert.equal(promo.mediaKind, "sticker");
  assert.ok(promo.mediaFile?.endsWith(".webp"), "стикер скачан");
  assert.ok(promo.mediaPosterFile?.endsWith(".jpg"), "эскиз скачан");
  assert.ok(existsSync(join(mediaDir, promo.mediaFile)));
  assert.ok(existsSync(join(mediaDir, promo.mediaPosterFile)));
  const [card] = await listActivePromos();
  assert.equal(card.mediaKind, "sticker");
  assert.equal(card.image, `/api/promos/${promo.id}/image`);
  assert.equal(
    card.imagePoster,
    `/api/promos/${promo.id}/image?variant=poster`,
  );

  await handlePromoUpdateOnce(update("/del " + promo.number, 6939112736, 51));
  assert.equal((await listPromos()).length, 0);
  assert.equal(
    readdirSync(mediaDir).length,
    0,
    "файлы стикера и эскиза удалены вместе с карточкой",
  );
});

test("апдейты: видео-стикер (webm) с постером, tgs — отказ", async () => {
  await handlePromoUpdateOnce({
    update_id: 60,
    message: {
      message_id: 60,
      chat: { id: 6939112736 },
      sticker: {
        file_id: "sticker-video",
        is_video: true,
        thumbnail: { file_id: "thumb-file" },
      },
    },
  });
  const [video] = await listPromos();
  assert.ok(video.mediaFile?.endsWith(".webm"));
  assert.equal(video.mediaKind, "sticker");
  assert.ok(video.mediaPosterFile?.endsWith(".jpg"));

  await handlePromoUpdateOnce({
    update_id: 61,
    message: {
      message_id: 61,
      chat: { id: 6939112736 },
      sticker: { file_id: "tgs-file", is_animated: true },
    },
  });
  assert.equal(
    (await listPromos()).length,
    1,
    "tgs-стикер карточку не создаёт",
  );
  assert.match(sentMessages.at(-1).text, /не поддерживаются/);
});

test("хранилище: без html-полей текст экранируется, \\n сохраняется", async () => {
  const promo = await createPromo({
    title: "Про <скидку>",
    text: "строка 1\nстрока 2",
  });
  assert.equal(promo.titleHtml, "Про &lt;скидку&gt;");
  assert.equal(promo.textHtml, "строка 1\nстрока 2");
  // Ценник подсвечивается и в фолбэке без html-полей.
  const priced = await createPromo({ title: "Набор 490 ₽" });
  assert.equal(priced.titleHtml, 'Набор <span class="tg-price">490 ₽</span>');
});

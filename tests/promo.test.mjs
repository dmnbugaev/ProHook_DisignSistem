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
  if (url.includes("getFile"))
    return new Response(
      JSON.stringify({ result: { file_path: "photos/card.png" } }),
      { status: 200 },
    );
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

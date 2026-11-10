/* global Response */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { createJiti } from "jiti";

// Свежий каталог и быстрые повторы до импорта модулей: стор читает env
// при импорте, диспетчер — паузу ретраев.
const dataDir = mkdtempSync(join(tmpdir(), "prohook-partnership-"));
process.env.PARTNERSHIP_DATA_DIR = dataDir;
process.env.TELEGRAM_RETRY_DELAY_MS = "1";
// Резервный канал МойСклад в тестах отключён (в шелле разработчика могут
// быть экспортированы боевые токены).
process.env.NUXT_MOYSKLAD_TOKEN = "";
process.env.MOYSKLAD_TOKEN = "";
process.env.MOYSKLAD_NOTIFY_EMPLOYEE_ID = "";

const jiti = createJiti(import.meta.url);
const { validatePartnership } = await jiti.import(
  "../shared/utils/partnership.ts",
);
const { sendPartnership, parseTelegramChatIds } = await jiti.import(
  "../server/services/telegram.ts",
);
const { allowPartnership } = await jiti.import(
  "../server/utils/partnership-rate-limit.ts",
);
const { dispatchPartnershipNotification } = await jiti.import(
  "../server/services/partnership-telegram.ts",
);
const { createPartnership, listPartnerships } = await jiti.import(
  "../server/services/partnership-store.ts",
);
const valid = {
  name: "Иван Иванов",
  phone: "+7 (999) 123-45-67",
  city: "Москва",
  company: "Компания",
  offer: "Хотим поставлять продукцию в вашу розничную сеть.",
  consent: true,
  consentTelegram: true,
};

test("validates and trims input without trusting types, consents or offers", () => {
  assert.equal(
    validatePartnership({ ...valid, name: " Иван Иванов " }).data.name,
    valid.name,
  );
  assert.equal(validatePartnership(valid).valid, true);
  for (const body of [
    null,
    [],
    {},
    { ...valid, consent: "true" },
    { ...valid, consentTelegram: "true" },
    { ...valid, consentTelegram: false },
    { ...valid, phone: "abc1234567890" },
    { ...valid, offer: "Коротко" },
    { ...valid, offer: "с".repeat(501) },
    { ...valid, company: "x".repeat(151) },
    { ...valid, name: "Иван\nКатегория: подмена" },
  ]) {
    assert.equal(validatePartnership(body).valid, false);
  }
});
test("collapses offer whitespace so messages cannot be forged", () => {
  const { data, errors } = validatePartnership({
    ...valid,
    offer: "  Оптовые   закупки,\nсовместные   акции\tи поставки  ",
  });
  assert.equal(errors.offer, undefined);
  assert.equal(data.offer, "Оптовые закупки, совместные акции и поставки");
});
test("sends all fields as plain text to configured chats", async () => {
  const chats = [];
  await sendPartnership(
    "fake-token",
    ["-123", "-456"],
    valid,
    "test-id",
    async (url, options) => {
      assert.equal(url, "https://api.telegram.org/botfake-token/sendMessage");
      const body = JSON.parse(options.body);
      chats.push(body.chat_id);
      assert.equal(body.parse_mode, undefined);
      for (const value of [
        valid.name,
        valid.phone,
        valid.city,
        valid.company,
        `Предложение: ${valid.offer}`,
        "test-id",
        "Согласие на обработку персональных данных: получено",
        "Согласие на передачу через Telegram: получено",
      ])
        assert.ok(body.text.includes(value));
      return new Response(
        JSON.stringify({ ok: true, result: { message_id: 1 } }),
      );
    },
  );
  assert.deepEqual(chats, ["-123", "-456"]);
});
test("succeeds when at least one chat receives the message", async () => {
  let calls = 0;
  const report = await sendPartnership(
    "fake-token",
    ["-123", "-456"],
    valid,
    "test-id",
    async () => {
      calls++;
      return calls === 1
        ? new Response('{"ok":false}')
        : new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }));
    },
  );
  assert.deepEqual(report.deliveredTo, ["-456"]);
  assert.deepEqual(report.fatalTo, []);
});
test("parses comma-separated chat ids", () => {
  assert.deepEqual(parseTelegramChatIds(" 6939112736 , -100123 ,"), [
    "6939112736",
    "-100123",
  ]);
  assert.deepEqual(parseTelegramChatIds(",, ,"), []);
});
test("does not report success on Telegram rejection or network failure", async () => {
  for (const request of [
    async () => new Response('{"ok":false}'),
    async () => new Response("oops", { status: 502 }),
    async () => {
      throw new Error("network");
    },
  ]) {
    const report = await sendPartnership(
      "fake-token",
      ["-123"],
      valid,
      "test-id",
      request,
    );
    assert.deepEqual(report.deliveredTo, []);
    assert.deepEqual(report.fatalTo, []);
  }
});
test("marks fatally rejected chats for the dispatcher", async () => {
  // 400 «chat not found» и 403 — фатальные для чата отказы: получатель не
  // начинал диалог с ботом или заблокировал его (диагностика 10.11.2026).
  const report = await sendPartnership(
    "fake-token",
    ["-123", "-456", "-789"],
    valid,
    "test-id",
    async (url, options) => {
      const chatId = JSON.parse(options.body).chat_id;
      if (chatId === "-123")
        return new Response(
          '{"ok":false,"error_code":400,"description":"Bad Request: chat not found"}',
        );
      if (chatId === "-456")
        return new Response(
          '{"ok":false,"error_code":403,"description":"Forbidden: bot was blocked by the user"}',
        );
      return new Response(
        JSON.stringify({ ok: true, result: { message_id: 1 } }),
      );
    },
  );
  assert.deepEqual(report.deliveredTo, ["-789"]);
  assert.deepEqual(
    report.fatalTo.map((entry) => entry.chatId),
    ["-123", "-456"],
  );
  assert.match(report.fatalTo[0].description, /chat not found/);
});
test("limits attempts and expires windows", () => {
  for (let i = 0; i < 5; i++)
    assert.equal(allowPartnership("test-ip", 1000), true);
  assert.equal(allowPartnership("test-ip", 1000), false);
  assert.equal(allowPartnership("test-ip", 901001), true);
});
test("dispatch covers every chat, retrying only the missing one", async () => {
  const application = await createPartnership(valid);
  const sentTo = [];
  let chat456Calls = 0;
  const request = async (url, options) => {
    const chatId = JSON.parse(options.body).chat_id;
    sentTo.push(chatId);
    // Флап: второй чат проходит только со второго к нему обращения.
    if (chatId === "-456") chat456Calls++;
    const ok = chatId === "-123" || chat456Calls >= 2;
    return new Response(
      ok
        ? JSON.stringify({ ok: true, result: { message_id: 1 } })
        : '{"ok":false}',
    );
  };
  await dispatchPartnershipNotification(
    application,
    valid,
    "fake-token",
    ["-123", "-456"],
    request,
  );
  // Попытка 1: оба чата (-123 ок, -456 нет), попытка 2: только -456.
  assert.deepEqual(sentTo, ["-123", "-456", "-456"]);
  const [stored] = await listPartnerships(1);
  assert.equal(stored.id, application.id);
  assert.equal(stored.telegramDelivery.attempts, 2);
  assert.deepEqual(stored.telegramDelivery.deliveredTo, ["-123", "-456"]);
});

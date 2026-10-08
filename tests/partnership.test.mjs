/* global Response */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";
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
  await sendPartnership(
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
    await assert.rejects(
      sendPartnership("fake-token", ["-123"], valid, "test-id", request),
    );
  }
});
test("limits attempts and expires windows", () => {
  for (let i = 0; i < 5; i++)
    assert.equal(allowPartnership("test-ip", 1000), true);
  assert.equal(allowPartnership("test-ip", 1000), false);
  assert.equal(allowPartnership("test-ip", 901001), true);
});

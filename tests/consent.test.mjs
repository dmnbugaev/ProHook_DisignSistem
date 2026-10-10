import { test } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const {
  buildConsent,
  parseConsent,
  CONSENT_COOKIE_NAME,
  CONSENT_COOKIE_MAX_AGE,
  CONSENT_VERSION,
} = await jiti("../shared/analytics/consent.ts");

// ------------------------------------------------- схема cookie-согласия

test("имя и срок cookie согласия зафиксированы", () => {
  assert.equal(CONSENT_COOKIE_NAME, "prohook-consent");
  // 180 дней — решение переспрашивается дважды в год.
  assert.equal(CONSENT_COOKIE_MAX_AGE, 60 * 60 * 24 * 180);
  assert.equal(CONSENT_VERSION, 1);
});

test("buildConsent производит решение, переживающее запись в cookie", () => {
  const state = buildConsent(true);
  assert.equal(state.v, CONSENT_VERSION);
  assert.equal(state.analytics, true);
  assert.equal(typeof state.ts, "number");
  assert.deepEqual(parseConsent(JSON.stringify(state)), state);
});

test("parseConsent принимает и строку cookie, и уже разобранный объект", () => {
  const raw = '{"v":1,"analytics":false,"ts":123}';
  const expected = { v: 1, analytics: false, ts: 123 };
  assert.deepEqual(parseConsent(raw), expected);
  assert.deepEqual(parseConsent({ v: 1, analytics: false, ts: 123 }), expected);
});

test("отсутствие ts не ломает решение (хранится 0)", () => {
  assert.deepEqual(parseConsent('{"v":1,"analytics":true}'), {
    v: 1,
    analytics: true,
    ts: 0,
  });
});

test("мусор и чужие версии — нет решения, баннер покажется заново", () => {
  for (const bad of [
    undefined,
    null,
    "",
    "garbage",
    "{}",
    "[]",
    "3",
    "true",
    '{"v":2,"analytics":true}',
    '{"v":1,"analytics":"yes"}',
    '{"v":1}',
    { v: 2, analytics: true },
    { v: 1, analytics: 1 },
    { analytics: true },
  ]) {
    assert.equal(
      parseConsent(bad),
      null,
      `ожидалось отсутствие решения для ${JSON.stringify(bad)}`,
    );
  }
});

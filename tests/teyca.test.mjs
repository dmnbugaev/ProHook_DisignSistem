/* global process, Response */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

// Изолированный каталог данных до импорта модуля: teyca.ts читает
// ACCOUNT_DATA_DIR при загрузке (путь файла токена).
const dataDir = await mkdtemp(join(tmpdir(), "prohook-teyca-"));
process.env.ACCOUNT_DATA_DIR = dataDir;
// Готовый токен экземпляра — бутстрап не тестируем здесь (для него
// отдельные файлы с чистым состоянием процесса).
process.env.TEYCA_API_KEY = "unit-test-key";
process.env.TEYCA_API_TOKEN = "preset-token";
delete process.env.NUXT_TEYCA_API_KEY;

const jiti = createJiti(import.meta.url);
const { findTeycaClientIdByPhone, getTeycaPassByUserId } = await jiti.import(
  "../server/services/teyca.ts",
);

// Формы ответов — из официальной документации https://api.teyca.ru:
// user_id приходит ЧИСЛОМ («user_id»: 17895), bonus — числом или строкой.
const PASS_NUMERIC = {
  user_id: 17895,
  phone: "79991234567",
  bonus: 100,
  loyalty_level: "Серебряный",
  discount: "10%",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** fetch-заглушка: handler(url) отвечает Response; все вызовы записываются. */
function makeFetch(handler) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({
      url: String(url),
      method: init.method ?? "GET",
      auth: init.headers?.Authorization,
    });
    return handler(String(url));
  };
  impl.calls = calls;
  return impl;
}

test("поиск по телефону привязывает карту с числовым user_id", async () => {
  const fetch = makeFetch((url) => {
    if (url.includes("/passes"))
      return jsonResponse({ meta: { size: 1 }, passes: [PASS_NUMERIC] });
    return jsonResponse({}, 404);
  });
  const found = await findTeycaClientIdByPhone("79991234567", fetch);
  assert.deepEqual(found, { ok: true, value: { userId: "17895" } });
  assert.equal(fetch.calls.length, 1);
  assert.ok(fetch.calls[0].url.includes("phone%3D79991234567"));
  assert.equal(fetch.calls[0].auth, "unit-test-key");
  assert.ok(fetch.calls[0].url.includes("/v1/preset-token/"));
});

test("поиск находит карту, хранящую телефон в формате 8…", async () => {
  const fetch = makeFetch((url) => {
    if (url.includes("phone%3D89991234567"))
      return jsonResponse({ passes: [PASS_NUMERIC] });
    return jsonResponse({ passes: [] });
  });
  const found = await findTeycaClientIdByPhone("79991234567", fetch);
  assert.deepEqual(found, { ok: true, value: { userId: "17895" } });
});

test("поиск различает кандидатов по цифрам телефона", async () => {
  const fetch = makeFetch(() =>
    jsonResponse({
      passes: [{ user_id: 1, phone: "79990000000", bonus: 0 }, PASS_NUMERIC],
    }),
  );
  const found = await findTeycaClientIdByPhone("79991234567", fetch);
  assert.deepEqual(found, { ok: true, value: { userId: "17895" } });
});

test("единственный кандидат без телефона принимается", async () => {
  const fetch = makeFetch(() =>
    jsonResponse({ passes: [{ user_id: 42, bonus: "5" }] }),
  );
  const found = await findTeycaClientIdByPhone("79991234567", fetch);
  assert.deepEqual(found, { ok: true, value: { userId: "42" } });
});

test("без карты в Тейка возвращается пустой userId", async () => {
  const fetch = makeFetch(() => jsonResponse({ passes: [] }));
  const found = await findTeycaClientIdByPhone("79991234567", fetch);
  assert.deepEqual(found, { ok: true, value: { userId: "" } });
});

test("карта без user_id пропускается как несуществующая", async () => {
  const fetch = makeFetch(() =>
    jsonResponse({ passes: [{ phone: "79991234567", bonus: 0 }] }),
  );
  const found = await findTeycaClientIdByPhone("79991234567", fetch);
  assert.deepEqual(found, { ok: true, value: { userId: "" } });
});

test("баланс читается по user_id: числовой id и числовой bonus", async () => {
  const fetch = makeFetch((url) => {
    if (url.includes("/passes/userid/17895")) return jsonResponse(PASS_NUMERIC);
    return jsonResponse({}, 404);
  });
  const pass = await getTeycaPassByUserId("17895", fetch);
  assert.deepEqual(pass, {
    ok: true,
    value: {
      userId: "17895",
      balance: 100,
      loyaltyLevel: "Серебряный",
      discount: "10%",
      phone: "79991234567",
    },
  });
});

test("баланс: строковые user_id и bonus по-прежнему поддерживаются", async () => {
  const fetch = makeFetch((url) => {
    if (url.includes("/passes/userid/77"))
      return jsonResponse({ user_id: "77", bonus: "250" });
    return jsonResponse({}, 404);
  });
  const pass = await getTeycaPassByUserId("77", fetch);
  assert.deepEqual(pass, { ok: true, value: { userId: "77", balance: 250 } });
});

test("текстовая ошибка API (например 403 «Не авторизован!») даёт unavailable", async () => {
  const fetch = makeFetch(
    () => new Response("Не авторизован!", { status: 403 }),
  );
  const pass = await getTeycaPassByUserId("17895", fetch);
  assert.deepEqual(pass, { ok: false, reason: "unavailable" });
});

test("сетевой сбой при поиске даёт unavailable", async () => {
  const fetch = makeFetch(() => {
    throw new TypeError("fetch failed");
  });
  const found = await findTeycaClientIdByPhone("79991234567", fetch);
  assert.deepEqual(found, { ok: false, reason: "unavailable" });
});

test("без ключа API — not-configured без единого запроса", async () => {
  const savedKey = process.env.TEYCA_API_KEY;
  const savedToken = process.env.TEYCA_API_TOKEN;
  delete process.env.TEYCA_API_KEY;
  delete process.env.TEYCA_API_TOKEN;
  try {
    const fetch = makeFetch(() => jsonResponse({ passes: [PASS_NUMERIC] }));
    assert.deepEqual(await findTeycaClientIdByPhone("79991234567", fetch), {
      ok: false,
      reason: "not-configured",
    });
    assert.deepEqual(await getTeycaPassByUserId("17895", fetch), {
      ok: false,
      reason: "not-configured",
    });
    assert.equal(fetch.calls.length, 0);
  } finally {
    process.env.TEYCA_API_KEY = savedKey;
    process.env.TEYCA_API_TOKEN = savedToken;
  }
});

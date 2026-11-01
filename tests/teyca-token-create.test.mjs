/* global process, Response */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

// Бутстрап токена с чистым состоянием процесса: env и импорт до любых вызовов.
const dataDir = await mkdtemp(join(tmpdir(), "prohook-teyca-create-"));
process.env.ACCOUNT_DATA_DIR = dataDir;
process.env.TEYCA_API_KEY = "unit-test-key";
delete process.env.TEYCA_API_TOKEN;
delete process.env.NUXT_TEYCA_API_KEY;

const jiti = createJiti(import.meta.url);
const { findTeycaClientIdByPhone } = await jiti.import(
  "../server/services/teyca.ts",
);

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("заблокированный токен не переиспользуется: создаётся новый", async () => {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, method: init.method ?? "GET" });
    if (
      target.endsWith("/v1/authorization") &&
      (init.method ?? "GET") === "GET"
    )
      return jsonResponse({
        limit: 1,
        // Наш identifier есть, но токен заблокирован (status: false) —
        // такой переиспользовать нельзя: каждый запрос вернёт 401.
        tokens: [
          {
            identifier: "prohook-website",
            token: "blocked-old",
            status: false,
          },
        ],
      });
    if (target.endsWith("/v1/authorization"))
      return jsonResponse({
        identifier: "prohook-website",
        token: "created-token",
        status: true,
        limit: 0,
      });
    if (target.startsWith("https://api.teyca.ru/v1/created-token/"))
      return jsonResponse({
        passes: [{ user_id: 17895, phone: "79991234567", bonus: 0 }],
      });
    if (target.startsWith("https://api.teyca.ru/v1/blocked-old/"))
      return new Response("Токен не найден или заблокирован!", { status: 401 });
    return jsonResponse({}, 404);
  };

  const found = await findTeycaClientIdByPhone("79991234567", fetch);
  assert.deepEqual(found, { ok: true, value: { userId: "17895" } });

  assert.deepEqual(
    calls.map((call) => `${call.method} ${call.url}`),
    [
      "GET https://api.teyca.ru/v1/authorization",
      "POST https://api.teyca.ru/v1/authorization",
      "GET https://api.teyca.ru/v1/created-token/passes?search=phone%3D79991234567&limit=20&offset=0",
    ],
  );

  const saved = JSON.parse(
    await readFile(join(dataDir, "teyca-token.json"), "utf8"),
  );
  assert.equal(saved.token, "created-token");
});

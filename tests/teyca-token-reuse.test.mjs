/* global process, Response */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

// Бутстрап токена с чистым состоянием процесса: env и импорт до любых вызовов.
const dataDir = await mkdtemp(join(tmpdir(), "prohook-teyca-reuse-"));
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

test("существующий активный токен используется повторно, без создания нового", async () => {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, method: init.method ?? "GET" });
    if (
      target.endsWith("/v1/authorization") &&
      (init.method ?? "GET") === "GET"
    )
      return jsonResponse({
        limit: 0,
        tokens: [
          {
            identifier: "другой-экземпляр",
            token: "someone-else",
            status: true,
          },
          {
            identifier: "prohook-website",
            token: "reused-token",
            status: true,
          },
        ],
      });
    if (target.endsWith("/v1/authorization"))
      return jsonResponse({ error: "не ожидался POST" }, 400);
    if (target.startsWith("https://api.teyca.ru/v1/reused-token/"))
      return jsonResponse({
        passes: [{ user_id: 17895, phone: "79991234567", bonus: 0 }],
      });
    return jsonResponse({}, 404);
  };

  const found = await findTeycaClientIdByPhone("79991234567", fetch);
  assert.deepEqual(found, { ok: true, value: { userId: "17895" } });

  // Никакого POST /v1/authorization: новые токены не создаём — их лимит
  // на стороне TEYCA исчерпаем (docs: «ограничит возможность создания»).
  assert.deepEqual(
    calls.map((call) => `${call.method} ${call.url}`),
    [
      "GET https://api.teyca.ru/v1/authorization",
      "GET https://api.teyca.ru/v1/reused-token/passes?search=phone%3D79991234567&limit=20&offset=0",
    ],
  );

  // Токен сохранён локально: следующий старт не спросит список заново.
  const saved = JSON.parse(
    await readFile(join(dataDir, "teyca-token.json"), "utf8"),
  );
  assert.equal(saved.token, "reused-token");
});

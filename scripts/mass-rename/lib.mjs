// Общий хелпер: токен из .env + fetch к МойСкладу с ретраями.
import process from "node:process";
import { URL } from "node:url";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(
  new URL("../../.env", import.meta.url),
  "utf8",
).split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
export const TOKEN =
  process.env.NUXT_MOYSKLAD_TOKEN ||
  env.NUXT_MOYSKLAD_TOKEN ||
  env.MOYSKLAD_TOKEN;
if (!TOKEN) throw new Error("NUXT_MOYSKLAD_TOKEN is not set");

const API = "https://api.moysklad.ru/api/remap/1.2/";

export async function msFetch(path, init = {}) {
  const url = path instanceof URL ? path : new URL(path, API);
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/json;charset=utf-8",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(60000),
    });
    if (response.ok) return response;
    if ((response.status === 429 || response.status >= 500) && attempt < 5) {
      await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
      continue;
    }
    throw new Error(
      `HTTP ${response.status} ${url.pathname}: ${(await response.text()).slice(0, 300)}`,
    );
  }
}

export async function allRows(path) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = new URL(path, API);
    url.searchParams.set("limit", "1000");
    url.searchParams.set("offset", String(offset));
    const page = await (await msFetch(url.toString())).json();
    rows.push(...page.rows);
    if (page.rows.length < 1000 || rows.length >= (page.meta.size ?? Infinity))
      break;
  }
  return rows;
}

export const idOf = (ref) => ref?.meta?.href?.split("?")[0]?.split("/").at(-1);

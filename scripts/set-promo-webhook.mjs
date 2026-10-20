import { readFile } from "node:fs/promises";
import process from "node:process";
import { URL } from "node:url";

// .env читается только для локального запуска (не перезаписывает уже
// выставленные переменные окружения).
try {
  const source = await readFile(new URL("../.env", import.meta.url), "utf8");
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z_0-9]*)=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
} catch {
  // Секреты могут прийти из окружения.
}

const token = process.env.TELEGRAM_PROMO_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_PROMO_WEBHOOK_SECRET?.trim();
const siteUrl =
  process.env.PROMO_WEBHOOK_SITE_URL?.trim() || "https://прохук.рф";

if (!token) {
  console.error("TELEGRAM_PROMO_BOT_TOKEN не задан (.env или окружение).");
  process.exit(1);
}
if (!secret) {
  console.error(
    "TELEGRAM_PROMO_WEBHOOK_SECRET не задан — без секрета вебхук небезопасен.",
  );
  process.exit(1);
}

const url = `https://api.telegram.org/bot${token}/setWebhook`;
const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: `${siteUrl}/api/telegram/promo/webhook`,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  }),
  signal: AbortSignal.timeout(15000),
});
const payload = await response.json();
if (!response.ok || payload?.ok !== true) {
  console.error(
    `setWebhook не выполнен: HTTP ${response.status}`,
    JSON.stringify(payload),
  );
  process.exit(1);
}
console.log(
  `Вебхук бота акций зарегистрирован: ${siteUrl}/api/telegram/promo/webhook`,
);
console.log(
  "Напоминание: на VPS держите TELEGRAM_PROMO_POLLING=0 и тот же TELEGRAM_PROMO_WEBHOOK_SECRET.",
);

/**
 * Ручной сброс пароля аккаунта по номеру телефона (поддержка ProHook).
 *
 * Прод (vapeserver, /var/www/ProHookSite):
 *   sudo node scripts/reset-password.mjs +7\ 999\ 123-45-67
 *
 * Карточка аккаунта без правки:
 *   sudo node scripts/reset-password.mjs 79991234567 --show
 *
 * Порядок: хеш считается заранее, затем скрипт останавливает prohook.service
 * (стор держит users.json в памяти и затёр бы правку при следующем persist),
 * делает бэкап, атомарно вписывает новый Argon2id-хеш и запускает сервис
 * обратно с health-check. Перед рестартом проверяется реле-туннель Telegram
 * (prohook-telegram-relay): старт при мёртвом туннеле заклинивает
 * undici-диспетчер бота акций (инцидент 13.11). Пароль без аргумента
 * генерируется одноразовый и печатается ровно один раз.
 */
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  chownSync,
  copyFileSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import process from "node:process";
import { randomInt, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { normalizePhone, formatPhone, formatDateOfBirth, fullName } =
  await jiti.import("../shared/utils/account.ts");
const { hashPassword, verifyPassword } = await jiti.import(
  "../server/services/user-store.ts",
);

const DEFAULT_SERVICE = "prohook";
const DEFAULT_PORT = 3000;
// Реле-туннель Telegram: api.telegram.org → 127.0.0.2 → ssh -L → myserver.
const RELAY_SERVICE = "prohook-telegram-relay.service";
// Без похожих символов: 0/o, 1/l/i вырезаны.
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

/**
 * Правила пароля зеркалят validateRegistration (shared/utils/account.ts),
 * чтобы сброшенный пароль гарантированно проходил вход.
 */
export function validatePasswordPolicy(password) {
  if (typeof password !== "string" || password.length < 8)
    return "Пароль должен содержать минимум 8 символов.";
  if (password.length > 128) return "Пароль: до 128 символов.";
  if (!password.trim()) return "Пароль не может состоять из пробелов.";
  return null;
}

/** Одноразовый пароль вида k7mq-2vhn-9dpa (~60 бит энтропии). */
export function generateOneTimePassword() {
  const group = () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(
      "",
    );
  return [group(), group(), group()].join("-");
}

export function readUsersFile(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "EACCES")
      throw new Error(`Нет прав на ${filePath} — запустите под sudo.`, {
        cause: error,
      });
    throw new Error(
      `Не найден ${filePath} — аккаунтов ещё нет (или не тот каталог данных).`,
      { cause: error },
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  if (!parsed || !Array.isArray(parsed.users))
    throw new Error(
      `${filePath} повреждён (нет массива users) — править нельзя, разберитесь вручную.`,
    );
  return parsed;
}

/** Атомарная запись с сохранением владельца и прав исходного файла. */
function writeUsersFileAtomic(filePath, data) {
  const prev = statSync(filePath);
  const temp = `${filePath}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(data));
  chmodSync(temp, prev.mode & 0o777);
  if (process.getuid?.() === 0) chownSync(temp, prev.uid, prev.gid);
  renameSync(temp, filePath);
}

/**
 * Свежее чтение → бэкап → новый хеш → атомарная запись. Вызывается только
 * при остановленном сервисе (иначе память сервера затрёт правку).
 */
export function applyPasswordReset(filePath, phone, passwordHash, nowIso) {
  const data = readUsersFile(filePath);
  const user = data.users.find((item) => item.phone === phone);
  if (!user) throw new Error(`Аккаунт с телефоном ${phone} не найден.`);
  const backup = `${filePath}.bak-${nowIso.replace(/[:.]/g, "-")}`;
  copyFileSync(filePath, backup);
  const prev = statSync(filePath);
  chmodSync(backup, prev.mode & 0o777);
  if (process.getuid?.() === 0) chownSync(backup, prev.uid, prev.gid);
  user.passwordHash = passwordHash;
  user.updatedAt = nowIso;
  writeUsersFileAtomic(filePath, data);
  return { user, backup };
}

export function parseArgs(argv) {
  const flags = {
    show: false,
    dryRun: false,
    noRestart: false,
    ignoreRelay: false,
    service: DEFAULT_SERVICE,
    port: DEFAULT_PORT,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--show") flags.show = true;
    else if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--no-restart") flags.noRestart = true;
    else if (arg === "--ignore-relay") flags.ignoreRelay = true;
    else if (arg === "--service") {
      if (!argv[i + 1]) throw new Error("--service требует имя юнита");
      flags.service = argv[++i];
    } else if (arg === "--port") {
      const port = Number(argv[++i]);
      if (!Number.isInteger(port) || port < 1 || port > 65535)
        throw new Error("--port требует порт 1–65535");
      flags.port = port;
    } else if (arg === "-h" || arg === "--help") flags.help = true;
    else if (arg.startsWith("--"))
      throw new Error(`Неизвестный флаг: ${arg} (см. --help)`);
    else positional.push(arg);
  }
  if (positional.length > 2)
    throw new Error("Лишние аргументы: ожидается <телефон> [пароль]");
  flags.phoneRaw = positional[0] ?? "";
  flags.password = positional[1];
  return flags;
}

function printUsage() {
  process.stdout.write(`Использование:
  node scripts/reset-password.mjs <телефон> [новыйПароль] [флаги]

Без пароля генерируется одноразовый вида k7mq-2vhn-9dpa.
Флаги:
  --show          карточка аккаунта, ничего не менять
  --dry-run       подготовить сброс без остановки сервиса и записи
  --no-restart    править файл без systemctl (сервис уже остановлен!)
  --ignore-relay  рестартить даже при мёртвом реле Telegram (риск клина бота)
  --service ИМЯ   юнит systemd (по умолчанию ${DEFAULT_SERVICE})
  --port ПОРТ     порт health-check после старта (по умолчанию ${DEFAULT_PORT})
`);
}

function printUserCard(user) {
  const rows = [
    ["Аккаунт", fullName(user)],
    ["Телефон", formatPhone(user.phone)],
    ["Родился", formatDateOfBirth(user.dateOfBirth)],
    ["Тейка", user.teycaClientId ? "карта привязана" : "не привязана"],
    ["Создан", new Date(user.createdAt).toLocaleString("ru-RU")],
    ["Обновлён", new Date(user.updatedAt).toLocaleString("ru-RU")],
  ];
  for (const [label, value] of rows)
    process.stdout.write(`${(label + ":").padEnd(10)}${value}\n`);
}

function runSystemctl(action, unit) {
  try {
    execFileSync("systemctl", [action, unit], { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

function relayAlive() {
  try {
    execFileSync("systemctl", ["is-active", "--quiet", RELAY_SERVICE]);
    return true;
  } catch {
    return false;
  }
}

async function waitForHealth(port, attempts = 30) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return true;
    } catch {
      // Сервис ещё поднимается — ждём следующей попытки.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printUsage();
    return;
  }
  const phone = normalizePhone(flags.phoneRaw);
  if (!phone) {
    printUsage();
    process.stderr.write(
      `\nТелефон не распознан: «${flags.phoneRaw}». Формат: +7 (999) 123-45-67.\n`,
    );
    process.exit(2);
  }
  const usersFile = resolve(
    process.env.ACCOUNT_DATA_DIR || ".data/account",
    "users.json",
  );
  const user = readUsersFile(usersFile).users.find(
    (item) => item.phone === phone,
  );
  if (!user) {
    process.stderr.write(`Аккаунт ${formatPhone(phone)} не найден.\n`);
    process.exit(1);
  }

  if (flags.show) {
    printUserCard(user);
    return;
  }

  const password = flags.password ?? generateOneTimePassword();
  const policyError = validatePasswordPolicy(password);
  if (policyError) {
    process.stderr.write(`${policyError}\n`);
    process.exit(2);
  }

  // Хеш считаем до остановки сервиса — простой короче.
  const passwordHash = await hashPassword(password);
  process.stdout.write(
    `Сброс пароля: ${fullName(user)} (${formatPhone(phone)})\n`,
  );
  if (flags.dryRun) {
    process.stdout.write(
      "[dry-run] Хеш подготовлен, файл не меняется, сервис не трогаем.\n",
    );
    return;
  }

  if (!flags.noRestart && process.getuid?.() !== 0) {
    process.stderr.write(
      "Остановка/запуск systemd требует sudo (или --dry-run).\n",
    );
    process.exit(1);
  }

  if (!flags.noRestart && !flags.ignoreRelay && !relayAlive()) {
    process.stderr.write(
      `Реле Telegram (${RELAY_SERVICE}) не активен.\n` +
        "Старт prohook при мёртвом туннеле заклинивает бота акций (инцидент 13.11).\n" +
        "Поднимите реле или повторите с --ignore-relay.\n",
    );
    process.exit(1);
  }

  if (!flags.noRestart && !runSystemctl("stop", flags.service)) {
    process.stderr.write(
      `Не удалось остановить ${flags.service}.service — отмена, файл не тронут.\n`,
    );
    process.exit(1);
  }

  let reset;
  try {
    reset = applyPasswordReset(
      usersFile,
      phone,
      passwordHash,
      new Date().toISOString(),
    );
    process.stdout.write(`Бэкап: ${reset.backup}\n`);
  } finally {
    if (!flags.noRestart) runSystemctl("start", flags.service);
  }

  if (!flags.noRestart) {
    process.stdout.write("Запуск сервиса… ");
    if (!(await waitForHealth(flags.port))) {
      process.stderr.write(
        `не ответил на 127.0.0.1:${flags.port} за 15 с.\n` +
          `Логи: journalctl -u ${flags.service} -n 50\n`,
      );
      process.exit(1);
    }
    process.stdout.write("ok\n");
  }

  // Контрольное чтение файла: хеш в нём обязан подтверждать пароль.
  const stored = readUsersFile(usersFile).users.find(
    (item) => item.phone === phone,
  );
  const verified = stored
    ? await verifyPassword(stored.passwordHash, password)
    : false;

  process.stdout.write("\nНовый пароль (показан один раз):\n");
  process.stdout.write(`    ${password}\n`);
  if (!verified) {
    process.stderr.write(
      "ВНИМАНИЕ: хеш в файле не подтверждает пароль — разберитесь вручную.\n",
    );
    process.exit(1);
  }
  process.stdout.write("Проверка хеша: ok\n");
  process.stdout.write(
    "Передайте пароль владельцу лично; сменит он его сам пока не может.\n",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  });
}

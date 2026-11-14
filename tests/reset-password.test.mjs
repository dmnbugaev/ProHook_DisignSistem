import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyPasswordReset,
  generateOneTimePassword,
  parseArgs,
  readUsersFile,
  validatePasswordPolicy,
} from "../scripts/reset-password.mjs";

// Изолированный каталог на процесс тестов.
const dataDir = await mkdtemp(join(tmpdir(), "prohook-reset-"));
const usersFile = join(dataDir, "users.json");

after(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

const user = (id, phone, passwordHash) => ({
  id,
  phone,
  lastName: "Иванов",
  firstName: "Иван",
  middleName: "",
  dateOfBirth: "2000-01-01",
  passwordHash,
  teycaClientId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

before(async () => {
  await writeFile(
    usersFile,
    JSON.stringify({
      version: 1,
      users: [
        user("u1", "79991234567", "old-hash-1"),
        user("u2", "79990001122", "old-hash-2"),
      ],
    }),
    { mode: 0o600 },
  );
});

test("applyPasswordReset меняет только целевого пользователя", async () => {
  const { user: updated, backup } = applyPasswordReset(
    usersFile,
    "79991234567",
    "new-hash",
    "2026-11-14T10-00-00-000Z",
  );
  assert.equal(updated.passwordHash, "new-hash");
  assert.equal(updated.updatedAt, "2026-11-14T10-00-00-000Z");

  const stored = readUsersFile(usersFile);
  assert.equal(stored.version, 1);
  assert.equal(stored.users.length, 2);
  const untouched = stored.users.find((item) => item.id === "u2");
  assert.equal(untouched.passwordHash, "old-hash-2");
  assert.equal(untouched.updatedAt, "2026-01-01T00:00:00.000Z");

  // Бэкап создан рядом, права исходного файла сохранены.
  await stat(backup);
  assert.equal((await stat(usersFile)).mode & 0o777, 0o600);
});

test("applyPasswordReset не трогает файл, если аккаунта нет", async () => {
  const before = await readFile(usersFile, "utf8");
  assert.throws(
    () =>
      applyPasswordReset(
        usersFile,
        "79995556677",
        "x-hash",
        "2026-11-14T10-00-00-000Z",
      ),
    /не найден/,
  );
  assert.equal(await readFile(usersFile, "utf8"), before);
});

test("readUsersFile бракует повреждённый и отсутствующий файл", async () => {
  const broken = join(dataDir, "broken.json");
  await writeFile(broken, '{"version":1}');
  assert.throws(() => readUsersFile(broken), /повреждён/);

  const garbage = join(dataDir, "garbage.json");
  await writeFile(garbage, "не-json");
  assert.throws(() => readUsersFile(garbage), /повреждён/);

  assert.throws(
    () => readUsersFile(join(dataDir, "missing.json")),
    /не найден/i,
  );
});

test("generateOneTimePassword: формат, уникальность, политика сайта", () => {
  const pattern =
    /^[23456789abcdefghjkmnpqrstuvwxyz]{4}(-[23456789abcdefghjkmnpqrstuvwxyz]{4}){2}$/;
  const samples = Array.from({ length: 50 }, generateOneTimePassword);
  for (const password of samples) {
    assert.match(password, pattern);
    assert.equal(validatePasswordPolicy(password), null);
  }
  // 50 генераций по ~60 бит — совпадений быть не должно.
  assert.equal(new Set(samples).size, 50);
});

test("validatePasswordPolicy зеркалит правила регистрации", () => {
  assert.equal(validatePasswordPolicy("12345678"), null);
  assert.match(validatePasswordPolicy("1234567"), /минимум 8/);
  assert.match(validatePasswordPolicy("x".repeat(129)), /до 128/);
  assert.match(validatePasswordPolicy("        "), /пробелов/);
  assert.match(validatePasswordPolicy(""), /минимум 8/);
});

test("parseArgs: позиции, флаги, значения по умолчанию", () => {
  const simple = parseArgs(["89991234567", "secret-pw"]);
  assert.equal(simple.phoneRaw, "89991234567");
  assert.equal(simple.password, "secret-pw");
  assert.equal(simple.service, "prohook");
  assert.equal(simple.port, 3000);
  assert.equal(simple.show, false);
  assert.equal(simple.dryRun, false);
  assert.equal(simple.noRestart, false);
  assert.equal(simple.ignoreRelay, false);

  const full = parseArgs([
    "79991234567",
    "--show",
    "--service",
    "prohook2",
    "--port",
    "3002",
  ]);
  assert.equal(full.show, true);
  assert.equal(full.service, "prohook2");
  assert.equal(full.port, 3002);
  assert.equal(full.password, undefined);

  assert.equal(parseArgs([]).phoneRaw, "");
  assert.equal(
    parseArgs(["79991234567", "--dry-run", "--no-restart", "--ignore-relay"])
      .ignoreRelay,
    true,
  );
  assert.throws(
    () => parseArgs(["79991234567", "--bogus"]),
    /Неизвестный флаг/,
  );
  assert.throws(() => parseArgs(["a", "b", "c"]), /Лишние аргументы/);
  assert.throws(() => parseArgs(["79991234567", "--port", "99999"]), /порт/);
});

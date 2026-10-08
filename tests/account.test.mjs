/* global process, Response */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

// Изолированный каталог данных на процесс тестов.
const dataDir = await mkdtemp(join(tmpdir(), "prohook-account-"));
process.env.ACCOUNT_DATA_DIR = dataDir;

const jiti = createJiti(import.meta.url);
const account = await jiti.import("../shared/utils/account.ts");
const {
  validateRegistration,
  validateLogin,
  normalizePhone,
  formatPhone,
  parseBirthDate,
  isAdult,
  pluralBonus,
  toSessionUser,
} = account;

const valid = {
  lastName: "Иванов",
  firstName: "Иван",
  middleName: "Иванович",
  dateOfBirth: "01.01.2000",
  phone: "+7 (999) 123-45-67",
  password: "secret123",
  passwordConfirm: "secret123",
  consent: true,
};

test("normalizePhone brings RU formats to 7XXXXXXXXXX", () => {
  assert.equal(normalizePhone("+7 (999) 123-45-67"), "79991234567");
  assert.equal(normalizePhone("89991234567"), "79991234567");
  assert.equal(normalizePhone("9991234567"), "79991234567");
  assert.equal(normalizePhone("+7 999 123 45 67"), "79991234567");
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizePhone("+380991234567"), null);
  assert.equal(normalizePhone("8999123456"), null);
});

test("formatPhone renders normalized phone for display", () => {
  assert.equal(formatPhone("79991234567"), "+7 999 123-45-67");
});

test("parseBirthDate accepts DD.MM.YYYY and YYYY-MM-DD, rejects garbage", () => {
  assert.equal(parseBirthDate("01.01.2000"), "2000-01-01");
  assert.equal(parseBirthDate("2000-01-01"), "2000-01-01");
  assert.equal(parseBirthDate("31.02.2000"), null);
  assert.equal(parseBirthDate("00.01.2000"), null);
  assert.equal(parseBirthDate("01.01.1899"), null);
  assert.equal(parseBirthDate("2000-13-01"), null);
  assert.equal(parseBirthDate(""), null);
  assert.equal(parseBirthDate("2000/01/01"), null);
});

test("isAdult compares exact dates, not year difference", () => {
  assert.equal(isAdult("2008-10-05", "2026-10-05"), true);
  assert.equal(isAdult("2008-10-06", "2026-10-05"), false);
  assert.equal(isAdult("2000-01-01", "2026-10-05"), true);
  assert.equal(isAdult("2026-01-01", "2026-10-05"), false);
  assert.equal(isAdult("2008-02-29", "2026-02-28"), false);
  assert.equal(isAdult("2008-02-29", "2026-03-01"), true);
  assert.equal(isAdult("не-дата", "2026-10-05"), false);
});

test("registration validation: full pass with trimming", () => {
  const result = validateRegistration({
    ...valid,
    lastName: " Иванов ",
    firstName: "Иван",
  });
  assert.deepEqual(Object.keys(result.errors), []);
  assert.equal(result.valid, true);
  assert.equal(result.data.phone, "79991234567");
  assert.equal(result.data.dateOfBirth, "2000-01-01");
  assert.equal(result.data.lastName, "Иванов");
  // Тело запроса должно нести подтверждение пароля — сервер сверяет сам.
  assert.equal(result.data.passwordConfirm, "secret123");
});

test("registration validation rejects bad input", () => {
  for (const body of [
    null,
    [],
    {},
    { ...valid, lastName: "" },
    { ...valid, lastName: "   " },
    { ...valid, firstName: "Иван123" },
    { ...valid, middleName: "<script>" },
    { ...valid, phone: "12345" },
    { ...valid, phone: "" },
    { ...valid, dateOfBirth: "31.02.2000" },
    { ...valid, password: "short" },
    { ...valid, password: "        " },
    { ...valid, passwordConfirm: "different" },
    { ...valid, consent: false },
    { ...valid, consent: "true" },
  ]) {
    assert.equal(
      validateRegistration(body).valid,
      false,
      `expected invalid: ${JSON.stringify(body)}`,
    );
  }
  // Дата в будущем отклоняется без фиксированного today.
  const future = new Date();
  future.setUTCFullYear(future.getUTCFullYear() + 1);
  assert.equal(
    validateRegistration({
      ...valid,
      dateOfBirth: future.toISOString().slice(0, 10),
    }).errors.dateOfBirth,
    "Дата рождения не может быть в будущем.",
  );
  // Несовпадение паролей — отдельная ошибка подтверждения.
  assert.equal(
    validateRegistration({ ...valid, passwordConfirm: "nope12345" }).errors
      .passwordConfirm,
    "Пароли не совпадают.",
  );
});

test("login validation normalizes phone", () => {
  const ok = validateLogin({ phone: "+7 (999) 123-45-67", password: "x" });
  assert.equal(ok.valid, true);
  assert.equal(ok.data.phone, "79991234567");
  assert.equal(validateLogin({ phone: "123", password: "x" }).valid, false);
  assert.equal(validateLogin({ phone: "79991234567" }).valid, false);
});

test("pluralBonus and toSessionUser shape", () => {
  assert.equal(pluralBonus(1), "бонус");
  assert.equal(pluralBonus(21), "бонус");
  assert.equal(pluralBonus(2), "бонуса");
  assert.equal(pluralBonus(1250), "бонусов");
  // «Ровно 17 лет сегодня»: дата считается динамически, чтобы тест не
  // протухал по календарю (раньше была константой 2008-10-06).
  const today = new Date().toISOString().slice(0, 10);
  const [year, month, day] = today.split("-");
  const minorDob = `${Number(year) - 17}-${month}-${day}`;
  const session = toSessionUser({
    id: "u1",
    phone: "79991234567",
    lastName: "Иванов",
    firstName: "Иван",
    middleName: "Иванович",
    dateOfBirth: minorDob,
    teycaClientId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(session.isAdult, false);
  assert.equal(session.canViewProductImages, false);
  assert.equal(session.teycaLinked, false);
  assert.equal("passwordHash" in session, false);
});

// ---- хранилища пользователей и сессий ----------------------------------

const userStore = await jiti.import("../server/services/user-store.ts");
const sessionStore = await jiti.import("../server/services/session-store.ts");

test("user store: hash+verify, unique phone, update teyca link", async () => {
  const created = await userStore.createUser({
    phone: "79991234567",
    lastName: "Иванов",
    firstName: "Иван",
    middleName: "Иванович",
    dateOfBirth: "2000-01-01",
    password: "secret123",
  });
  assert.ok(created.passwordHash.startsWith("$argon2id$"));
  assert.equal(created.teycaClientId, null);
  assert.notEqual(created.passwordHash, "secret123");

  assert.equal(
    (await userStore.findUserByPhone("79991234567"))?.id,
    created.id,
  );
  await assert.rejects(
    userStore.createUser({
      phone: "79991234567",
      lastName: "Пётр",
      firstName: "Петров",
      middleName: "Петрович",
      dateOfBirth: "1990-05-05",
      password: "another123",
    }),
    /Phone already registered/,
  );

  assert.equal(
    await userStore.verifyPassword(created.passwordHash, "secret123"),
    true,
  );
  assert.equal(
    await userStore.verifyPassword(created.passwordHash, "wrong1234"),
    false,
  );
  // Файл не содержит пароль в открытом виде.
  const raw = await readFile(join(dataDir, "users.json"), "utf8");
  assert.ok(!raw.includes("secret123"));

  const updated = await userStore.updateUser(created.id, {
    teycaClientId: "teyca-42",
  });
  assert.equal(updated?.teycaClientId, "teyca-42");
  assert.equal((await userStore.findUserByTeycaId("teyca-42"))?.id, created.id);
});

test("session store: token hashed on disk, expires, deleted", async () => {
  const userId = "user-1";
  const token = await sessionStore.createSession(userId);
  assert.match(token, /^[a-f0-9]{64}$/);
  const stored = await sessionStore.getSession(token);
  assert.equal(stored?.userId, userId);
  // На диске нет самого токена — только SHA-256.
  const raw = await readFile(join(dataDir, "sessions.json"), "utf8");
  assert.ok(!raw.includes(token));
  assert.ok(raw.includes(userId));
  await sessionStore.deleteSession(token);
  assert.equal(await sessionStore.getSession(token), undefined);
  assert.equal(await sessionStore.getSession("nope"), undefined);
});

// ---- Teyca service: парсинг ответов без настоящих запросов -------------

const teyca = await jiti.import("../server/services/teyca.ts");
const TEYCA_PASS = JSON.stringify({
  user_id: "card-777",
  bonus: "1250",
  discount: "5%",
  loyalty_level: "Серебряный",
  phone: "+79876543211",
});

test("teyca: not configured without key", async () => {
  delete process.env.TEYCA_API_KEY;
  delete process.env.NUXT_TEYCA_API_KEY;
  assert.equal(teyca.isTeycaConfigured(), false);
  const result = await teyca.findTeycaClientIdByPhone("79876543211");
  assert.deepEqual(result, { ok: false, reason: "not-configured" });
});

test("teyca: finds client by phone and parses string bonus", async () => {
  process.env.TEYCA_API_KEY = "test-key";
  process.env.TEYCA_API_TOKEN = "instance-token";
  const requests = [];
  const search = await teyca.findTeycaClientIdByPhone(
    "79876543211",
    async () => {
      requests.push("search");
      return new Response(
        JSON.stringify({
          meta: { size: 1, limit: 20, offset: 0 },
          passes: JSON.parse(TEYCA_PASS),
        }),
      );
    },
  );
  assert.deepEqual(search, { ok: true, value: { userId: "card-777" } });
  assert.equal(requests.length, 1);

  const pass = await teyca.getTeycaPassByUserId("card-777", async (url) => {
    assert.ok(
      url.startsWith(
        "https://api.teyca.ru/v1/instance-token/passes/userid/card-777",
      ),
    );
    return new Response(TEYCA_PASS);
  });
  assert.equal(pass.ok, true);
  assert.equal(pass.value.balance, 1250);
  assert.equal(pass.value.discount, "5%");
  assert.equal(pass.value.loyaltyLevel, "Серебряный");
  delete process.env.TEYCA_API_KEY;
  delete process.env.TEYCA_API_TOKEN;
});

test("teyca: network failure maps to unavailable, keys never thrown", async () => {
  process.env.TEYCA_API_KEY = "test-key";
  process.env.TEYCA_API_TOKEN = "instance-token";
  const failed = await teyca.getTeycaPassByUserId(
    "card-777",
    async () => new Response("boom", { status: 500 }),
  );
  assert.deepEqual(failed, { ok: false, reason: "unavailable" });
  delete process.env.TEYCA_API_KEY;
  delete process.env.TEYCA_API_TOKEN;
});

// ---- rate limit ---------------------------------------------------------

const rateLimit = await jiti.import("../server/utils/auth-rate-limit.ts");

test("register rate limit: 5 per 15 minutes per ip", () => {
  for (let i = 0; i < 5; i++)
    assert.equal(rateLimit.allowRegister("ip-reg", 1000), true);
  assert.equal(rateLimit.allowRegister("ip-reg", 1000), false);
  assert.equal(rateLimit.allowRegister("ip-reg", 901001), true);
});

test("login rate limit: 10 per window per ip and per phone", () => {
  for (let i = 0; i < 10; i++)
    assert.equal(rateLimit.allowLogin("ip-login", "70000000001", 2000), true);
  assert.equal(rateLimit.allowLogin("ip-login", "70000000001", 2000), false);
  // Тот же ip с новым телефоном тоже заблокирован по ip-бакету.
  assert.equal(rateLimit.allowLogin("ip-login", "70000000002", 2000), false);
  // Другой ip с исчерпанным телефоном заблокирован по телефонному бакету.
  assert.equal(rateLimit.allowLogin("ip-other", "70000000001", 2000), false);
  assert.equal(rateLimit.allowLogin("ip-other", "70000000002", 902001), true);
});

test("cleanup of temp account data dir", async () => {
  await rm(dataDir, { recursive: true, force: true });
});

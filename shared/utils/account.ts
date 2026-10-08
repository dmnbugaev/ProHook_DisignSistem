import type { SessionUser } from "../types/account";

/** Полное имя пользователя для приветствия: «Иван Иванов». */
export function fullName(user: {
  firstName: string;
  lastName: string;
}): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ");
}

/**
 * Нормализация телефона в единый формат 7XXXXXXXXXX.
 * Принимает +7/8/голые 10 цифр; иначе — null.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let normalized: string;
  if (digits.length === 11 && digits.startsWith("8"))
    normalized = `7${digits.slice(1)}`;
  else if (digits.length === 11 && digits.startsWith("7")) normalized = digits;
  // 10-значный номер без кода страны допустим только с кода 9…
  else if (digits.length === 10 && digits.startsWith("9"))
    normalized = `7${digits}`;
  else return null;
  return /^7\d{10}$/.test(normalized) ? normalized : null;
}

/** 79991234567 → «+7 999 123-45-67». */
export function formatPhone(phone: string): string {
  if (!/^7\d{10}$/.test(phone)) return phone;
  return `+7 ${phone.slice(1, 4)} ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`;
}

/** YYYY-MM-DD → DD.MM.YYYY (для витрины). */
export function formatDateOfBirth(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  return isoDate.split("-").reverse().join(".");
}

/**
 * Разбор даты рождения: принимает DD.MM.YYYY (рукописный ввод) и
 * YYYY-MM-DD (input type="date"). Возвращает ISO-дату или null.
 */
export function parseBirthDate(input: string): string | null {
  const value = input.trim();
  const ru = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!ru && !iso) return null;
  const day = Number((ru ?? iso)![ru ? 1 : 3]);
  const month = Number((ru ?? iso)![2]);
  const year = Number((ru ?? iso)![ru ? 3 : 1]);
  if (year < 1900) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

/**
 * Совершеннолетие по точной дате, не по разнице годов:
 * 05.10.2008 при сегодняшней 05.10.2026 — уже 18; 06.10.2008 — ещё 17.
 * today передаётся только в тестах.
 */
export function isAdult(dateOfBirth: string, today?: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return false;
  const birth = dateOfBirth.split("-").map(Number);
  const now = today ?? new Date().toISOString().slice(0, 10);
  const current = now.split("-").map(Number);
  const year = birth[0] ?? 0;
  const month = birth[1] ?? 0;
  const day = birth[2] ?? 0;
  const nowYear = current[0] ?? 0;
  const nowMonth = current[1] ?? 0;
  const nowDay = current[2] ?? 0;
  if (year + 18 > nowYear) return false;
  if (year + 18 < nowYear) return true;
  if (month > nowMonth) return false;
  if (month < nowMonth) return true;
  return day <= nowDay;
}

export interface RegistrationData {
  lastName: string;
  firstName: string;
  middleName: string;
  dateOfBirth: string;
  phone: string;
  password: string;
  /** Дублируется в теле запроса: сервер сверяет совпадение сам. */
  passwordConfirm: string;
  consent: boolean;
}

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s'’-]*$/u;

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function nameError(value: string, label: string): string | undefined {
  if (!value) return `Укажите ${label}.`;
  if (value.length > 60) return `Слишком длинное значение (до 60 символов).`;
  if (!NAME_PATTERN.test(value))
    return `${label.slice(0, 1).toUpperCase()}${label.slice(1)} — только буквы, дефис и пробел.`;
  return undefined;
}

/**
 * Валидация регистрации. Используется и на клиенте (мгновенные подсказки),
 * и на сервере (источник истины). Пароль возвращается в data только для
 * передачи на свой сервер по same-origin запросу.
 */
export function validateRegistration(input: unknown): {
  data: RegistrationData;
  errors: Record<string, string>;
  valid: boolean;
} {
  const raw =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const errors: Record<string, string> = {};
  const lastName = cleanName(raw.lastName);
  const firstName = cleanName(raw.firstName);
  const middleName = cleanName(raw.middleName);
  const error = nameError(lastName, "фамилию");
  if (error) errors.lastName = error;
  const errorFirst = nameError(firstName, "имя");
  if (errorFirst) errors.firstName = errorFirst;
  const errorMiddle = nameError(middleName, "отчество");
  if (errorMiddle) errors.middleName = errorMiddle;

  const phoneRaw = typeof raw.phone === "string" ? raw.phone : "";
  const phone = normalizePhone(phoneRaw);
  if (!phone) errors.phone = "Укажите телефон в формате +7 (999) 123-45-67.";

  const dateOfBirth = parseBirthDate(
    typeof raw.dateOfBirth === "string" ? raw.dateOfBirth : "",
  );
  if (!dateOfBirth) errors.dateOfBirth = "Укажите дату рождения: ДД.ММ.ГГГГ.";
  else if (dateOfBirth > new Date().toISOString().slice(0, 10))
    errors.dateOfBirth = "Дата рождения не может быть в будущем.";

  const password = typeof raw.password === "string" ? raw.password : "";
  if (password.length < 8)
    errors.password = "Пароль должен содержать минимум 8 символов.";
  else if (password.length > 128) errors.password = "Пароль: до 128 символов.";
  else if (!password.trim())
    errors.password = "Пароль не может состоять из пробелов.";
  const passwordConfirm =
    typeof raw.passwordConfirm === "string" ? raw.passwordConfirm : "";
  if (!errors.password && password !== passwordConfirm)
    errors.passwordConfirm = "Пароли не совпадают.";
  if (!passwordConfirm && !errors.password)
    errors.passwordConfirm = "Повторите пароль.";

  if (raw.consent !== true)
    errors.consent = "Подтвердите согласие на обработку персональных данных.";

  return {
    data: {
      lastName,
      firstName,
      middleName,
      dateOfBirth: dateOfBirth ?? "",
      phone: phone ?? "",
      password,
      passwordConfirm,
      consent: raw.consent === true,
    },
    errors,
    valid: Object.keys(errors).length === 0,
  };
}

export function validateLogin(input: unknown): {
  data: { phone: string; password: string };
  errors: Record<string, string>;
  valid: boolean;
} {
  const raw =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const errors: Record<string, string> = {};
  const phone = normalizePhone(typeof raw.phone === "string" ? raw.phone : "");
  if (!phone) errors.phone = "Укажите телефон в формате +7 (999) 123-45-67.";
  const password = typeof raw.password === "string" ? raw.password : "";
  if (!password) errors.password = "Введите пароль.";
  return {
    data: { phone: phone ?? "", password },
    errors,
    valid: Object.keys(errors).length === 0,
  };
}

/** Русская плюрализация: 1 бонус / 2 бонуса / 5 бонусов. */
export function pluralBonus(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "бонус";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "бонуса";
  return "бонусов";
}

/** Клиентская форма пользователя для /api/auth/me. */
export function toSessionUser(user: {
  id: string;
  phone: string;
  lastName: string;
  firstName: string;
  middleName: string;
  dateOfBirth: string;
  teycaClientId: string | null;
  createdAt: string;
}): SessionUser {
  const adult = isAdult(user.dateOfBirth);
  return {
    id: user.id,
    phone: user.phone,
    lastName: user.lastName,
    firstName: user.firstName,
    middleName: user.middleName,
    dateOfBirth: user.dateOfBirth,
    isAdult: adult,
    canViewProductImages: adult,
    teycaLinked: user.teycaClientId != null,
    createdAt: user.createdAt,
  };
}

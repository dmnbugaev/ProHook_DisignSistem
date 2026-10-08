import type {
  ReservationData,
  ReservationItemInput,
} from "../types/reservation";
import { RESERVATION_LIMITS } from "../types/reservation";
import { normalizePhone } from "./account";

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s'’-]*$/u;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some(
    (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
  );
}

function cleanName(value: unknown): string {
  // Только trim: перевод строки в имени — мусор, а не форматирование
  // (пробелы внутри остаются как есть, как в партнёрской форме).
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Нормализует пункты списка: убирает дубли (суммирует количество),
 * отбрасывает мусор. Количество намеренно не обрезается — превышение
 * лимитов проверяется отдельными явными ошибками (молчаливое «урезание»
 * введло бы пользователя в заблуждение о составе запроса). Возвращает
 * null, если после нормализации список пуст.
 */
export function normalizeSelectionItems(
  input: unknown,
): ReservationItemInput[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const merged = new Map<string, number>();
  for (const raw of input.slice(0, 100)) {
    if (!raw || typeof raw !== "object") continue;
    const { productId, quantity } = raw as Record<string, unknown>;
    if (typeof productId !== "string" || !ID_PATTERN.test(productId)) continue;
    const amount =
      typeof quantity === "number" && Number.isInteger(quantity)
        ? quantity
        : NaN;
    if (!Number.isFinite(amount)) continue;
    merged.set(productId, (merged.get(productId) ?? 0) + Math.max(0, amount));
  }
  const items = [...merged.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .filter((item) => item.quantity > 0)
    .sort((a, b) => a.productId.localeCompare(b.productId));
  return items.length > 0 ? items : null;
}

/**
 * Валидация формы запроса на резерв. Используется и на клиенте (мгновенные
 * подсказки), и на сервере (источник истины). Из входного объекта берутся
 * только известные поля — mass assignment исключён конструкцией данных.
 */
export function validateReservation(input: unknown): {
  data: ReservationData;
  errors: Record<string, string>;
  valid: boolean;
} {
  const raw =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const errors: Record<string, string> = {};

  const name = cleanName(raw.name);
  if (!name) errors.name = "Укажите имя.";
  else if (name.length < 2) errors.name = "Укажите имя (минимум 2 символа).";
  else if (
    name.length > 80 ||
    !NAME_PATTERN.test(name) ||
    hasControlCharacters(name)
  )
    errors.name = "Имя — только буквы, дефис и пробел (до 80 символов).";

  const phone = normalizePhone(typeof raw.phone === "string" ? raw.phone : "");
  if (!phone) errors.phone = "Укажите телефон в формате +7 (999) 123-45-67.";

  const storeId = typeof raw.storeId === "string" ? raw.storeId.trim() : "";
  if (!storeId || !ID_PATTERN.test(storeId))
    errors.storeId = "Выберите магазин для самовывоза.";

  // Пробелы схлопываются: комментарий не может подделать строки сообщения.
  const comment =
    typeof raw.comment === "string"
      ? raw.comment.trim().replace(/\s+/g, " ")
      : "";
  if (
    comment.length > RESERVATION_LIMITS.maxCommentLength ||
    hasControlCharacters(comment)
  )
    errors.comment = `Комментарий — до ${RESERVATION_LIMITS.maxCommentLength} символов.`;

  const items = normalizeSelectionItems(raw.items);
  if (!items) errors.items = "Список товаров пуст.";
  else if (items.length > RESERVATION_LIMITS.maxItems)
    errors.items = `В списке может быть не более ${RESERVATION_LIMITS.maxItems} позиций.`;
  else if (
    items.some((item) => item.quantity > RESERVATION_LIMITS.maxItemQuantity)
  )
    errors.items = `Максимум ${RESERVATION_LIMITS.maxItemQuantity} шт. одного товара в одном запросе.`;
  else if (
    items.reduce((sum, item) => sum + item.quantity, 0) >
    RESERVATION_LIMITS.maxTotalQuantity
  )
    errors.items = `Суммарно в запросе может быть не более ${RESERVATION_LIMITS.maxTotalQuantity} шт.`;

  if (raw.consent !== true)
    errors.consent = "Подтвердите согласие на обработку персональных данных.";
  if (raw.consentTelegram !== true)
    errors.consentTelegram =
      "Подтвердите согласие на передачу запроса через Telegram.";

  return {
    data: {
      name,
      phone: phone ?? "",
      storeId,
      comment,
      consent: raw.consent === true,
      consentTelegram: raw.consentTelegram === true,
      items: items ?? [],
    },
    errors,
    valid: Object.keys(errors).length === 0,
  };
}

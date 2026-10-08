import type { Availability } from "./store";

/**
 * Сущность «запрос на резерв» (ReservationRequest). Сайт не продаёт товары
 * дистанционно: пользователь отправляет список выбранных товаров в
 * конкретный физический магазин, а продажа, проверка возраста и оплата
 * происходят только в самом магазине (15-ФЗ ст. 19, см. docs/COMPLIANCE.md).
 * Поэтому сущность называется ReservationRequest, а не Order, и статусов,
 * связанных с онлайн-оплатой, здесь нет.
 */
export type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "READY"
  | "REJECTED"
  | "EXPIRED"
  | "COMPLETED"
  | "CANCELLED";

/** Пункт списка выбранных товаров в форме (клиент → сервер). */
export interface ReservationItemInput {
  productId: string;
  quantity: number;
}

/** Данные формы запроса на резерв после валидации. */
export interface ReservationData {
  name: string;
  /** Нормализованный телефон: 7XXXXXXXXXX. */
  phone: string;
  storeId: string;
  comment: string;
  consent: boolean;
  consentTelegram: boolean;
  items: ReservationItemInput[];
}

/** Ответ POST /api/reservations. */
export interface ReservationCreatedResponse {
  ok: true;
  publicId: string;
  /** true, когда ответ выдан повторно по тому же Idempotency-Key. */
  replayed?: boolean;
}

/**
 * Лимиты списка выбранных товаров. Клиент применяет их для UX, сервер —
 * как источник истины (данные клиента не доверяются).
 */
export const RESERVATION_LIMITS = {
  maxItems: 20,
  maxItemQuantity: 10,
  maxTotalQuantity: 40,
  maxCommentLength: 500,
} as const;

/**
 * Верхняя граница количества для запроса на резерв по бакету наличия,
 * когда точный остаток серверу неизвестен (снимок без отчёта остатков).
 * Точное количество (если есть) приоритетнее и проверяется в API.
 */
export function reservationCapForAvailability(
  availability: Availability,
): number {
  switch (availability) {
    case "available":
      return RESERVATION_LIMITS.maxItemQuantity;
    case "low":
    case "unknown":
      return 3;
    default:
      return 0;
  }
}

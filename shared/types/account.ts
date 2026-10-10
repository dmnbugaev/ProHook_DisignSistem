/**
 * Публичная (клиентская) форма пользователя сессии.
 * Пароль, хеш и внутренние поля хранилища сюда не попадают.
 */
export interface SessionUser {
  id: string;
  /** Нормализованный телефон: 7XXXXXXXXXX. */
  phone: string;
  lastName: string;
  firstName: string;
  middleName: string;
  /** ISO-дата: YYYY-MM-DD. */
  dateOfBirth: string;
  /** true, если 18 лет уже исполнилось (точное сравнение дат). */
  isAdult: boolean;
  /**
   * Единый признак для UI: можно ли показывать изображения товаров.
   * Совпадает с серверной проверкой в /api/products/:id/images/:index.
   */
  canViewProductImages: boolean;
  /** Связь с картой клиента Тейка установлена. */
  teycaLinked: boolean;
  createdAt: string;
}

/** Ответ GET /api/auth/me. */
export interface MeResponse {
  user: SessionUser | null;
  /**
   * true для аккаунтов из allowlist STAFF_INBOX_PHONES: в личном кабинете
   * появляется инбокс заявок (резервы + партнёрство) — резервный канал,
   * пока Telegram-уведомления недоступны с хостинга.
   */
  staffInbox?: boolean;
}

export type LoyaltyAvailability =
  "ok" | "unlinked" | "unavailable" | "unauthorized";

/** Ответ GET /api/account/loyalty. */
export interface LoyaltyResponse {
  status: LoyaltyAvailability;
  /** Целое число бонусов по карте Тейка (status === "ok"). */
  balance?: number;
  /** Уровень лояльности из Тейка, если передан. */
  loyaltyLevel?: string;
  /** Скидка по карте из Тейка (например «10%»), если передана. */
  discount?: string;
  message?: string;
}

import type { H3Event } from "h3";

/**
 * Подтверждение 18+ из cookie гейта (декларация посетителя, не проверка
 * аккаунта). Определяет состав каталога: без него API отдаёт только
 * общедоступный ассортимент (AGE_PUBLIC_ROOT_CATEGORIES); изображения
 * регулируемых товаров по-прежнему требуют взрослую сессию.
 */
export function hasAgeConfirmation(event: H3Event): boolean {
  return getCookie(event, "prohook-age-confirmed") === "true";
}

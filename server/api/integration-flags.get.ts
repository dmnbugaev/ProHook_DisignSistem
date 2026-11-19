import { isTelegramDeliveryConfigured } from "../services/reservation-telegram";

/**
 * Публичные признаки настроенных интеграций (без секретов). Форма резерва
 * показывает обязательное согласие на передачу запроса через Telegram
 * только когда доставка действительно настроена; тем же условием
 * руководствуется серверная валидация — расхождение исключено
 * (по образцу сайта Бункера).
 */
export default defineEventHandler(() => ({
  telegramNotify: isTelegramDeliveryConfigured(),
}));

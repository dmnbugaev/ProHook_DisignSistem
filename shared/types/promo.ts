/**
 * Публичная карточка промо-акции (блок «Акции и предложения» на главной).
 * Наполняется владельцем через Telegram-бота; сервер отдаёт только активные.
 */
export interface PromoCard {
  id: string;
  title: string;
  text: string;
  /** Плашка-метка («Акция», «Скидка»…). */
  badge: string | null;
  /** Подпись кнопки-ссылки и адрес (внутренний путь или https). */
  ctaLabel: string | null;
  ctaHref: string | null;
  /** URL изображения карточки (/api/promos/:id/image) или null. */
  image: string | null;
  /** Цветовая схема карточки. */
  accent: "yellow" | "ink";
}

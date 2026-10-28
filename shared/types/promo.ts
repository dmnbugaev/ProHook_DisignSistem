/**
 * Публичная карточка промо-акции (блок «Акции и предложения» на главной).
 * Наполняется владельцем через Telegram-бота; сервер отдаёт только активные.
 */
export interface PromoCard {
  id: string;
  title: string;
  text: string;
  /**
   * Безопасный HTML разметки Telegram (strong/em/u/s/code/pre/blockquote/a/
   * спойлер), сгенерированный сервером; весь текст экранирован, теги — только
   * из allowlist. Переносы строк и отступы показывает white-space: pre-wrap.
   */
  titleHtml: string;
  textHtml: string;
  /** Плашка-метка («Акция», «Скидка»…). */
  badge: string | null;
  /** Подпись кнопки-ссылки и адрес (внутренний путь или https). */
  ctaLabel: string | null;
  ctaHref: string | null;
  /** URL изображения карточки (/api/promos/:id/image) или null. */
  image: string | null;
  /** Статический эскиз видео-стикера (?variant=poster) или null. */
  imagePoster: string | null;
  /** Фото-снимок оператора или стикер (отрисовка contain вместо cover). */
  mediaKind: "photo" | "sticker";
  /** Цветовая схема карточки. */
  accent: "yellow" | "ink";
}

import {
  RESERVATION_LIMITS,
  reservationCapForAvailability,
} from "../../shared/types/reservation";
import { validateReservation } from "../../shared/utils/reservation";
import { getCatalogSnapshot } from "../services/catalog-cache";
import {
  createReservation,
  type StoredReservationItem,
} from "../services/reservation-store";
import { dispatchReservationNotification } from "../services/reservation-telegram";
import {
  isSmartCaptchaConfigured,
  verifySmartCaptcha,
} from "../services/smartcaptcha";
import { enforceRegionalRestrictions } from "../../shared/legal/catalog-policy";
import { getSessionUser } from "../utils/session";
import { guardJsonRequest } from "../utils/request-guard";
import { allowReservation } from "../utils/reservation-rate-limit";
import {
  IDEMPOTENCY_KEY_PATTERN,
  idempotentResult,
  rememberIdempotentResult,
} from "../utils/idempotency";

/**
 * Создание запроса на резерв. Сайт не продаёт и не оплачивает товары:
 * создание запроса не является покупкой, продажа — только в выбранном
 * физическом магазине. Все критичные данные (магазин, товары, остатки,
 * количество) перепроверяются по серверному снимку МойСклад; цене клиента
 * доверять не нужно — сайт её не принимает и не фиксирует.
 */
export default defineEventHandler(async (event) => {
  const body = await guardJsonRequest(event, 8192);
  if (!allowReservation(getRequestIP(event) ?? "unknown")) {
    setResponseHeader(event, "Retry-After", 900);
    throw createError({ statusCode: 429, statusMessage: "Too many requests" });
  }
  if (
    body &&
    typeof body === "object" &&
    "website" in body &&
    (body as Record<string, unknown>).website
  ) {
    throw createError({ statusCode: 400, statusMessage: "Invalid submission" });
  }

  // Идемпотентность: double-submit/retry по Idempotency-Key возвращает
  // уже созданный запрос, не создавая второй.
  const headerKey = getHeader(event, "idempotency-key") ?? "";
  if (IDEMPOTENCY_KEY_PATTERN.test(headerKey)) {
    const existing = idempotentResult(headerKey);
    if (existing)
      return {
        ok: true as const,
        publicId: existing,
        replayed: true as const,
      };
  }

  const { data, errors, valid } = validateReservation(body);
  if (!valid)
    throw createError({
      statusCode: 422,
      statusMessage: "Invalid fields",
      data: { errors },
    });

  // SmartCaptcha проверяется ТОЛЬКО на сервере; frontend-виджет лишь
  // получает одноразовый токен. Без настроенного серверного ключа проверка
  // пропускается (локальная разработка/тесты) — production-конфигурация
  // описана в .env.example и docs/COMPLIANCE.md.
  let captchaVerifiedAt: string | null = null;
  if (isSmartCaptchaConfigured()) {
    const raw = body as Record<string, unknown>;
    const token =
      typeof raw.captchaToken === "string"
        ? raw.captchaToken.slice(0, 2048)
        : "";
    const passed = token
      ? await verifySmartCaptcha(token, getRequestIP(event))
      : false;
    if (!passed)
      throw createError({
        statusCode: 422,
        statusMessage: "Invalid fields",
        data: {
          errors: {
            captcha: "Пройдите проверку «Я не робот» и повторите отправку.",
          },
        },
      });
    captchaVerifiedAt = new Date().toISOString();
  }

  // Авторизованным несовершеннолетним аккаунтам функционал закрыт по
  // данным аккаунта; для остальных проверка возраста остаётся в магазине.
  const user = await getSessionUser(event);
  if (user && !user.isAdult)
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      data: { message: "Запросы на резерв доступны только совершеннолетним." },
    });

  // Магазин и товары перепроверяются по свежему серверному снимку.
  const snapshot = await getCatalogSnapshot();
  const store = snapshot.meta.stores.find((item) => item.id === data.storeId);
  if (!store)
    throw createError({
      statusCode: 422,
      statusMessage: "Invalid fields",
      data: {
        errors: { storeId: "Выбранный магазин недоступен — выберите другой." },
      },
    });

  const visible = enforceRegionalRestrictions(
    snapshot.products,
    snapshot.meta.stores,
  );
  const byId = new Map(visible.map((product) => [product.id, product]));
  const items: StoredReservationItem[] = [];
  const itemErrors: string[] = [];
  data.items.forEach((item, index) => {
    const product = byId.get(item.productId);
    if (!product) {
      itemErrors.push(
        `«${item.productId}»: товар больше не доступен на сайте.`,
      );
      return;
    }
    const offer = product.offers.find((entry) => entry.storeId === store.id);
    if (!offer) {
      itemErrors.push(
        `${index + 1}) «${product.name}» не представлен в выбранном магазине.`,
      );
      return;
    }
    // Точный остаток из отчёта МойСклад приоритетнее; иначе — бакет наличия.
    const exact = snapshot.stockDetail?.[item.productId]?.[store.id];
    const cap =
      typeof exact === "number"
        ? Math.max(0, Math.min(exact, RESERVATION_LIMITS.maxItemQuantity))
        : reservationCapForAvailability(offer.availability);
    if (cap <= 0)
      itemErrors.push(
        `${index + 1}) «${product.name}»: нет в наличии в выбранном магазине.`,
      );
    else if (item.quantity > cap)
      itemErrors.push(
        `${index + 1}) «${product.name}»: доступно к резерву ${cap} шт.`,
      );
    else
      items.push({
        productId: product.id,
        productNameSnapshot: product.name,
        quantity: item.quantity,
      });
  });
  if (itemErrors.length > 0)
    throw createError({
      statusCode: 422,
      statusMessage: "Invalid fields",
      data: {
        errors: {
          items: itemErrors.join(
            " Удалите или измените соответствующие позиции.",
          ),
        },
      },
    });

  const reservation = await createReservation({
    userId: user?.id ?? null,
    customerName: data.name,
    phone: data.phone,
    storeId: store.id,
    storeNameSnapshot: store.name,
    storeAddressSnapshot: store.address ?? "",
    comment: data.comment,
    consent: { personalData: data.consent, telegram: data.consentTelegram },
    captchaVerifiedAt,
    items,
  });
  if (IDEMPOTENCY_KEY_PATTERN.test(headerKey))
    rememberIdempotentResult(headerKey, reservation.publicId);

  // Уведомление сотрудников — best-effort после сохранения: сбой Telegram
  // не теряет запрос и не возвращает ошибку пользователю (повтор доставки
  // привязан к id запроса, дублей не создаёт).
  void dispatchReservationNotification(reservation).catch(() => {
    console.error(
      "Reservation notification dispatch failed:",
      reservation.publicId,
    );
  });

  return { ok: true as const, publicId: reservation.publicId };
});

import { getSessionUser } from "../../utils/session";
import { staffInboxAllowed } from "../../utils/staff-inbox";
import { listReservations } from "../../services/reservation-store";
import { listPartnerships } from "../../services/partnership-store";

/**
 * Инбокс сотрудников: свежие запросы на резерв и заявки на партнёрство.
 * Резервный канал оповещения: Telegram-уведомления с хостинга могут быть
 * недоступны (хостер блокирует api.telegram.org), заявки при этом
 * сохраняются сервером. Доступ — только аккаунтам из allowlist
 * STAFF_INBOX_PHONES (server-side env); персональные данные не кэшируются.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "no-store");
  const user = await getSessionUser(event);
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  if (!staffInboxAllowed(user.phone))
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  const [reservations, partnerships] = await Promise.all([
    listReservations(50),
    listPartnerships(50),
  ]);
  return {
    reservations: reservations.map((request) => ({
      publicId: request.publicId,
      status: request.status,
      createdAt: request.createdAt,
      expiresAt: request.expiresAt,
      customerName: request.customerName,
      phone: request.phone,
      storeName: request.storeNameSnapshot,
      storeAddress: request.storeAddressSnapshot,
      comment: request.comment,
      items: request.items.map((item) => ({
        name: item.productNameSnapshot,
        quantity: item.quantity,
      })),
      telegramDelivered: request.telegramDelivery.deliveredTo.length > 0,
    })),
    partnerships: partnerships.map((application) => ({
      publicId: application.publicId,
      createdAt: application.createdAt,
      name: application.name,
      phone: application.phone,
      city: application.city,
      company: application.company,
      offer: application.offer,
      telegramDelivered: application.telegramDelivery.deliveredTo.length > 0,
    })),
  };
});

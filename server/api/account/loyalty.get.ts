import { requireStoredUser } from "../../utils/session";
import {
  findTeycaClientIdByPhone,
  getTeycaPassByUserId,
  isTeycaConfigured,
} from "../../services/teyca";
import { updateUser } from "../../services/user-store";

const UNAVAILABLE = {
  status: "unavailable" as const,
  message: "Не удалось загрузить информацию о бонусах. Попробуйте позже.",
};

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "no-store");
  const user = await requireStoredUser(event);
  if (!isTeycaConfigured()) {
    throw createError({
      statusCode: 503,
      statusMessage: "Loyalty unavailable",
      data: UNAVAILABLE,
    });
  }
  // Ленивая привязка: карту могли выпустить уже после регистрации.
  let teycaClientId = user.teycaClientId;
  if (!teycaClientId) {
    const found = await findTeycaClientIdByPhone(user.phone);
    // «not-configured» здесь невозможен (проверено выше), «unavailable»
    // уходит как 503 — баланс без Тейка не показываем.
    if (!found.ok) {
      throw createError({
        statusCode: 503,
        statusMessage: "Loyalty unavailable",
        data: UNAVAILABLE,
      });
    }
    if (found.value.userId) {
      teycaClientId = found.value.userId;
      await updateUser(user.id, { teycaClientId });
    }
  }
  if (!teycaClientId) {
    // Клиента в Тейка нет; карта выдаётся в магазине, автоматически
    // не создаём — Тейка остаётся источником истины.
    return {
      status: "unlinked" as const,
      message:
        "Бонусная карта пока не привязана. Получите карту Прохук в магазине — после этого баланс появится здесь автоматически.",
    };
  }
  const pass = await getTeycaPassByUserId(teycaClientId);
  if (!pass.ok) {
    throw createError({
      statusCode: 503,
      statusMessage: "Loyalty unavailable",
      data: UNAVAILABLE,
    });
  }
  return {
    status: "ok" as const,
    balance: pass.value.balance,
    ...(pass.value.loyaltyLevel
      ? { loyaltyLevel: pass.value.loyaltyLevel }
      : {}),
    ...(pass.value.discount ? { discount: pass.value.discount } : {}),
  };
});

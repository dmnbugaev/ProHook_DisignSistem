import { validateRegistration } from "../../../shared/utils/account";
import { toSessionUser } from "../../../shared/utils/account";
import { allowRegister } from "../../utils/auth-rate-limit";
import { guardJsonRequest } from "../../utils/request-guard";
import { startSession } from "../../utils/session";
import {
  createUser,
  findUserByPhone,
  updateUser,
} from "../../services/user-store";
import { findTeycaClientIdByPhone } from "../../services/teyca";

export default defineEventHandler(async (event) => {
  const body = await guardJsonRequest(event, 16384);
  if (!allowRegister(getRequestIP(event) ?? "unknown")) {
    setResponseHeader(event, "Retry-After", 900);
    throw createError({ statusCode: 429, statusMessage: "Too many requests" });
  }
  const { data, errors, valid } = validateRegistration(body);
  if (!valid)
    throw createError({
      statusCode: 422,
      statusMessage: "Invalid fields",
      data: { errors },
    });
  if (await findUserByPhone(data.phone)) {
    // Без подтверждения enumeration: формулировка допускает обе причины.
    throw createError({
      statusCode: 409,
      statusMessage: "Phone unavailable",
      data: {
        errors: {
          phone:
            "Регистрация с этим номером недоступна. Возможно, вы уже регистрировались — попробуйте войти.",
        },
      },
    });
  }
  let user;
  try {
    user = await createUser(data);
  } catch (error) {
    // Единственная ожидаемая причина — гонка с параллельной регистрацией.
    if (error instanceof Error && error.message === "Phone already registered")
      throw createError({
        statusCode: 409,
        statusMessage: "Phone unavailable",
      });
    console.error(
      "Registration failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    throw createError({
      statusCode: 500,
      statusMessage: "Registration failed",
    });
  }
  // Привязка к Тейка по телефону — best effort, регистрацию не ломает.
  if (!user.teycaClientId) {
    const found = await findTeycaClientIdByPhone(user.phone);
    if (found.ok && found.value.userId)
      user =
        (await updateUser(user.id, {
          teycaClientId: found.value.userId,
        })) ?? user;
  }
  await startSession(event, user.id);
  return { user: toSessionUser(user) };
});

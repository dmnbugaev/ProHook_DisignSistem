import { validateLogin } from "../../../shared/utils/account";
import { toSessionUser } from "../../../shared/utils/account";
import { allowLogin } from "../../utils/auth-rate-limit";
import { guardJsonRequest } from "../../utils/request-guard";
import { startSession } from "../../utils/session";
import {
  findUserByPhone,
  verifyDummyPassword,
  verifyPassword,
} from "../../services/user-store";

export default defineEventHandler(async (event) => {
  const body = await guardJsonRequest(event, 4096);
  const { data, errors, valid } = validateLogin(body);
  if (!valid)
    throw createError({
      statusCode: 422,
      statusMessage: "Invalid fields",
      data: { errors },
    });
  if (!allowLogin(getRequestIP(event) ?? "unknown", data.phone)) {
    setResponseHeader(event, "Retry-After", 900);
    throw createError({ statusCode: 429, statusMessage: "Too many requests" });
  }
  const user = await findUserByPhone(data.phone);
  const passwordOk = user
    ? await verifyPassword(user.passwordHash, data.password)
    : // Одинаковое время ответа для несуществующего номера.
      (await verifyDummyPassword(data.password), false);
  if (!user || !passwordOk)
    // Единое сообщение: не раскрываем, что именно неверно.
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid credentials",
      data: { message: "Неверный телефон или пароль." },
    });
  await startSession(event, user.id);
  return { user: toSessionUser(user) };
});

import type { H3Event } from "h3";
import type { SessionUser } from "../../shared/types/account";
import { toSessionUser } from "../../shared/utils/account";
import {
  createSession,
  deleteSession,
  getSession,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "../services/session-store";
import { findUserById } from "../services/user-store";

/**
 * Сессия пользователя по cookie. Источник истины для возрастного контроля:
 * cookie возрастного гейта — только декларация, здесь же проверяется
 * дата рождения из аккаунта.
 */
export async function getSessionUser(
  event: H3Event,
): Promise<SessionUser | null> {
  const token = getCookie(event, SESSION_COOKIE);
  if (!token) return null;
  const session = await getSession(token);
  if (!session) return null;
  const user = await findUserById(session.userId);
  if (!user) return null;
  return toSessionUser(user);
}

/** Серверная проверка «можно ли отдавать изображения товаров». */
export async function canViewProductImages(event: H3Event): Promise<boolean> {
  const user = await getSessionUser(event);
  return user?.canViewProductImages === true;
}

export async function requireSessionUser(event: H3Event): Promise<SessionUser> {
  const user = await getSessionUser(event);
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  return user;
}

/** Внутренняя запись пользователя для эндпоинтов аккаунта. */
export async function requireStoredUser(
  event: H3Event,
): Promise<import("../services/user-store").StoredUser> {
  const token = getCookie(event, SESSION_COOKIE);
  const session = token ? await getSession(token) : undefined;
  const user = session ? await findUserById(session.userId) : undefined;
  if (!user)
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  return user;
}

export function setSessionCookie(event: H3Event, token: string): void {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Secure включается в production; SESSION_COOKIE_INSECURE=1 нужен только
    // для локальной проверки production-сборки по http (Playwright preview).
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.SESSION_COOKIE_INSECURE !== "1",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE, { sameSite: "lax", path: "/" });
}

export async function startSession(event: H3Event, userId: string) {
  setSessionCookie(event, await createSession(userId));
}

export async function endSession(event: H3Event): Promise<void> {
  const token = getCookie(event, SESSION_COOKIE);
  if (token) await deleteSession(token);
  clearSessionCookie(event);
}

import type { MeResponse, SessionUser } from "~~/shared/types/account";

/**
 * Сессия пользователя для SSR и клиента. /api/auth/me отдаёт только
 * безопасные поля; canViewProductImages совпадает с серверным гейтом
 * изображений, поэтому в HTML не попадает ни одного <img> товара.
 */
export function useSessionUser() {
  const requestFetch = import.meta.server ? useRequestFetch() : $fetch;
  const { data, pending, error, refresh } = useAsyncData<MeResponse>(
    "session-user",
    () => requestFetch<MeResponse>("/api/auth/me"),
    { dedupe: "cancel", default: () => ({ user: null }) },
  );
  const user = computed<SessionUser | null>(() => data.value?.user ?? null);
  const loggedIn = computed(() => user.value != null);
  const canViewProductImages = computed(
    () => user.value?.canViewProductImages === true,
  );
  return { user, loggedIn, canViewProductImages, pending, error, refresh };
}

/**
 * Записывает сессию в общий кэш Nuxt сразу из ответа register/login/logout.
 * Без повторного запроса /api/auth/me — навигация в кабинет не может
 * обогнать обновление состояния и показать анонимный вариант.
 */
export function setSessionUser(user: SessionUser | null) {
  const { data } = useNuxtData<MeResponse>("session-user");
  data.value = { user };
}

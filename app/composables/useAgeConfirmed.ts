/**
 * Общее состояние подтверждения 18+. Первая регистрация состояния
 * читает cookie (SSR видит подтверждение в запросе); записывает его
 * валидатор в layouts/default.vue. Страницам главная нужна эта же
 * реактивность, чтобы скрывать секции каталога от неподтвердивших —
 * в SSR краулер контента каталога не получает (инвариант
 * tests/legal.spec.ts).
 */
export function useAgeConfirmed() {
  const ageCookie = useCookie<boolean | null>("prohook-age-confirmed", {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return useState("age-confirmed", () => ageCookie.value === true);
}

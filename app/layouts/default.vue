<script setup lang="ts">
// Подтверждение 18+ сохраняется в cookie на год (локально в браузере) и
// доступно серверу при SSR: без подтверждения контент каталога не рендерится
// в HTML страницы. Публичные (не гейтируемые) маршруты: юридические страницы,
// аккаунт (регистрация сама запрашивает дату рождения) и информационные
// разделы, индексируемые поисковыми системами (/, /about, /stores,
// /partners) — каталогозависимые секции на них скрываются на уровне самих
// страниц (см. pages/index.vue). Страницы каталога (/catalog, /product,
// /search) рендерятся и до подтверждения: сервер отдаёт туда только
// общедоступный ассортимент, а полный каталог открывается блоком
// подтверждения на самой странице (AgeNotice) — модальный гейт на них
// не показывается (решение владельца 13.10.2026).
const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/stores",
  "/partners",
  "/privacy",
  "/personal-data",
  "/information",
  "/contacts",
  "/login",
  "/register",
  "/account",
];
const CATALOG_ROUTES = /^\/(catalog|product|search)(?:\/|$)/;
const ageCookie = useCookie<boolean | null>("prohook-age-confirmed", {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
});
const ageConfirmed = useAgeConfirmed();
watch(ageConfirmed, (value) => {
  if (value) ageCookie.value = true;
});
// Взрослый аккаунт — уже верифицированный посетитель: дата рождения из
// личного кабинета подтверждает возраст (источник истины), cookie гейта
// лишь фиксирует это для следующих страниц.
const { user, loggedIn } = useSessionUser();
watch(
  () => user.value?.isAdult,
  (adult) => {
    if (adult && !ageConfirmed.value) ageConfirmed.value = true;
  },
  { immediate: true },
);
const route = useRoute();
const showcase = computed(() => route.path === "/design-system");
const publicRoute = computed(() => PUBLIC_ROUTES.includes(route.path));
const catalogRoute = computed(() => CATALOG_ROUTES.test(route.path));
const contentVisible = computed(
  () => ageConfirmed.value || publicRoute.value || catalogRoute.value,
);
// Модальный гейт остаётся только на маршрутах вне публичных и каталогных
// (например, /reserve): там контент по-прежнему скрыт целиком.
const gated = computed(
  () => !ageConfirmed.value && !publicRoute.value && !catalogRoute.value,
);
// Окно подтверждения возраста открывается при входе на сайт (первая
// страница сессии) для всех, кто не вошёл в аккаунт и ещё не подтверждал
// возраст, — независимо от маршрута (решение заказчика 19.11.2026, вечер).
// Страницы входа/регистрации/кабинета не прерываем: посетитель идёт
// авторизоваться. Метка «предлагали» — session-cookie без maxAge (живёт до
// закрытия браузера); latch читается один раз при загрузке, чтобы метка не
// подавляла собственный первый показ. Контент закрытых маршрутов по-прежнему
// скрыт правилом `gated` выше — окно лишь спрашивает возраст на входе.
const AGE_MODAL_EXEMPT = ["/login", "/register", "/account"];
const gateShownCookie = useCookie<boolean | null>("prohook-age-gate-shown");
// Начальное значение — прямо из cookie (SSR тоже читает): повторная
// загрузка в той же сессии не мигает модалкой. Отдельный latch нужен,
// чтобы метка, которую ставит сам показ, не скрывала текущий показ.
const gateSuppressed = ref(gateShownCookie.value === true);
onMounted(() => {
  gateSuppressed.value = gateShownCookie.value === true;
});
const showAgeGate = computed(
  () =>
    !ageConfirmed.value &&
    !loggedIn.value &&
    !gateSuppressed.value &&
    !showcase.value &&
    !AGE_MODAL_EXEMPT.includes(route.path),
);
watch(showAgeGate, (shown) => {
  if (shown) gateShownCookie.value = true;
});
const { data: meta } = await useCatalogMeta();
const { store, pickerOpen, pickerDismissed, autoDetected, detect } =
  useStoreSelection();
watch(
  [ageConfirmed, meta, showcase, () => route.path],
  async () => {
    if (
      ageConfirmed.value &&
      meta.value &&
      !showcase.value &&
      route.path !== "/partners" &&
      // Служебные страницы (кабинет, вход, регистрация) окном выбора
      // магазина не прерываем — оно ждёт перехода в каталог.
      !["/account", "/login", "/register"].includes(route.path) &&
      !store.value &&
      // Закрытое без выбора окно не открываем заново до конца сессии.
      !pickerDismissed.value
    ) {
      await nextTick();
      // Диалог открывается сразу, а параллельно спрашиваем геолокацию:
      // успешный ответ сам подставит ближайший магазин и закроет окно.
      pickerOpen.value = true;
      void detect();
    }
  },
  { immediate: true },
);
// Плашка «магазин определён автоматически»: сама скрывается через 10 секунд.
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
watch(autoDetected, (value) => {
  if (noticeTimer) clearTimeout(noticeTimer);
  if (value)
    noticeTimer = setTimeout(() => (autoDetected.value = false), 10000);
});
onBeforeUnmount(() => noticeTimer && clearTimeout(noticeTimer));
</script>

<template>
  <div>
    <div id="top" :class="{ 'app-shell': !showcase }" :inert="gated">
      <a class="skip-link" href="#main">Перейти к содержимому</a>
      <SiteHeader v-if="showcase" />
      <template v-else>
        <LegalNotice />
        <AppHeader />
        <!-- Бегущая строка 18+ — на всех страницах (решение владельца
             21.10: вернуть; с 10.10 пряталась на публичных маршрутах как
             побочный эффект их открытия для индексации). -->
        <AgeMarquee />
      </template>
      <main id="main">
        <template v-if="contentVisible || showcase"><slot /></template>
        <p v-else class="caption age-hint">
          Содержимое сайта доступно после подтверждения совершеннолетнего
          возраста.
          <button
            type="button"
            class="text-link"
            @click="gateSuppressed = false"
          >
            Подтвердить 18+
          </button>
        </p>
      </main>
      <SiteFooter v-if="showcase" />
      <AppFooter v-else />
    </div>
    <AgeGate v-if="showAgeGate" v-model="ageConfirmed" />
    <StorePicker v-if="(ageConfirmed || catalogRoute) && !showcase" />
    <!-- Баннер согласия на cookie: до подтверждения 18+ и пока открыто
         окно возраста не показываем — два поверхностных слоя не наслаиваются. -->
    <CookieConsent v-if="(contentVisible && !showAgeGate) || showcase" />
    <div v-if="autoDetected" class="geo-note" role="status">
      <p class="caption">
        Ближайший магазин — <strong>{{ store?.name }}</strong
        >. Выбран автоматически по вашему местоположению.
      </p>
      <div class="geo-note__actions">
        <button type="button" class="text-link" @click="pickerOpen = true">
          Изменить
        </button>
        <UiIconButton label="Скрыть" @click="autoDetected = false"
          ><span aria-hidden="true">×</span></UiIconButton
        >
      </div>
    </div>
    <noscript
      >Для подтверждения возраста 18+ и доступа к сайту включите
      JavaScript.</noscript
    >
  </div>
</template>

<script setup lang="ts">
// Подтверждение 18+ сохраняется в cookie на год (локально в браузере) и
// доступно серверу при SSR: без подтверждения контент каталога не рендерится
// в HTML страницы. Юридические страницы и маршруты аккаунта (регистрация
// сама запрашивает дату рождения) открыты без гейта.
const OPEN_ROUTES = [
  "/privacy",
  "/personal-data",
  "/information",
  "/contacts",
  "/login",
  "/register",
  "/account",
];
const ageCookie = useCookie<boolean | null>("prohook-age-confirmed", {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
});
const ageConfirmed = useState("age-confirmed", () => ageCookie.value === true);
watch(ageConfirmed, (value) => {
  if (value) ageCookie.value = true;
});
const route = useRoute();
const showcase = computed(() => route.path === "/design-system");
const publicRoute = computed(() => OPEN_ROUTES.includes(route.path));
const contentVisible = computed(() => ageConfirmed.value || publicRoute.value);
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
    <div
      id="top"
      :class="{ 'app-shell': !showcase }"
      :inert="!ageConfirmed && !publicRoute"
    >
      <a class="skip-link" href="#main">Перейти к содержимому</a>
      <SiteHeader v-if="showcase" />
      <template v-else>
        <LegalNotice />
        <AppHeader />
        <AgeMarquee v-if="!publicRoute" />
      </template>
      <main id="main">
        <template v-if="contentVisible || showcase"><slot /></template>
        <p v-else class="caption age-hint">
          Содержимое сайта доступно после подтверждения совершеннолетнего
          возраста.
        </p>
      </main>
      <SiteFooter v-if="showcase" />
      <AppFooter v-else />
    </div>
    <AgeGate v-if="!publicRoute" v-model="ageConfirmed" />
    <StorePicker v-if="ageConfirmed && !showcase" />
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

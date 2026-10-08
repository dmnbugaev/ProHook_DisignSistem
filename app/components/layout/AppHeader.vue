<script setup lang="ts">
const menuOpen = ref(false);
const scrolled = ref(false);
const route = useRoute();
const { store, city, pickerOpen } = useStoreSelection();
const { loggedIn } = useSessionUser();
const { count } = useSelectionList();
const accountLink = computed(() =>
  loggedIn.value
    ? { to: "/account", label: "Личный кабинет" }
    : { to: "/login", label: "Войти" },
);
const links = computed(() => [
  { to: "/catalog", label: "Каталог" },
  { to: "/about", label: "О проекте" },
  { to: "/stores", label: "Магазины" },
  { to: "/contacts", label: "Контакты" },
  { to: "/partners", label: "Стать партнёром" },
]);
function onScroll() {
  if (window.scrollY > 40) scrolled.value = true;
  else if (window.scrollY < 16) scrolled.value = false;
}
watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false;
  },
);
onMounted(() => {
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
});
onBeforeUnmount(() => window.removeEventListener("scroll", onScroll));
</script>
<template>
  <header
    class="site-header app-header"
    :class="{ 'site-header--glass': scrolled || route.path !== '/' }"
  >
    <NuxtLink to="/" class="brand-link" aria-label="Прохук — главная"
      ><img src="/brand/mark.webp" width="40" height="40" alt=""
    /></NuxtLink>
    <nav class="desktop-nav" aria-label="Основная навигация">
      <NuxtLink v-for="link in links" :key="link.to" :to="link.to">{{
        link.label
      }}</NuxtLink>
    </nav>
    <div class="header-actions">
      <button type="button" class="store-trigger" @click="pickerOpen = true">
        <span class="caption">{{ city?.name ?? "Ваш город" }}</span
        ><span
          >{{ store?.name ?? "Выбрать магазин" }}
          <span aria-hidden="true">⌄</span></span
        >
      </button>
      <NuxtLink to="/search" class="icon-button" aria-label="Поиск"
        ><svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="10.5"
            cy="10.5"
            r="6.5"
            stroke="currentColor"
            stroke-width="2"
          />
          <path d="m16 16 5 5" stroke="currentColor" stroke-width="2" /></svg
      ></NuxtLink>
      <NuxtLink
        to="/reserve"
        class="icon-button selection-link"
        :aria-label="
          count > 0
            ? `Список выбранных товаров, позиций: ${count}`
            : 'Список выбранных товаров'
        "
        ><svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2.5 4h2.4l1 4M6 8h15l-1.9 7.4a2.1 2.1 0 0 1-2 1.6H9.4a2.1 2.1 0 0 1-2-1.6L6 8Z"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M10.4 11.2v3M14.2 11.2v3"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
          <circle
            cx="10"
            cy="20.3"
            r="1.55"
            stroke="currentColor"
            stroke-width="1.8"
          />
          <circle
            cx="16.8"
            cy="20.3"
            r="1.55"
            stroke="currentColor"
            stroke-width="1.8"
          /></svg
        ><span v-if="count > 0" class="selection-link__badge">{{
          count
        }}</span></NuxtLink
      >
      <NuxtLink
        :to="accountLink.to"
        class="account-link"
        :aria-label="accountLink.label"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2" />
          <path
            d="M4.5 20c1.6-3.2 4.3-5 7.5-5s5.9 1.8 7.5 5"
            stroke="currentColor"
            stroke-width="2"
          /></svg
        ><span>{{ accountLink.label }}</span></NuxtLink
      >
      <UiIconButton
        label="Открыть меню"
        class="menu-toggle"
        :aria-expanded="menuOpen"
        @click="menuOpen = true"
        ><svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 8h18M3 16h18"
            stroke="currentColor"
            stroke-width="2"
          /></svg
      ></UiIconButton>
    </div>
  </header>
  <UiDialog v-model="menuOpen" title="Меню" menu
    ><nav class="mobile-nav" aria-label="Мобильная навигация">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        @click="menuOpen = false"
        >{{ link.label }}</NuxtLink
      >
      <NuxtLink
        :to="accountLink.to"
        class="mobile-nav__account"
        @click="menuOpen = false"
        >{{ accountLink.label }}</NuxtLink
      >
      <NuxtLink
        to="/reserve"
        class="mobile-nav__account"
        @click="menuOpen = false"
        >Список выбранных<template v-if="count > 0">
          · {{ count }}</template
        ></NuxtLink
      >
    </nav>
    <p class="caption">Прохук · Каталог товаров</p></UiDialog
  >
</template>

<script setup lang="ts">
const menuOpen = ref(false);
const scrolled = ref(false);
const route = useRoute();
const { store, city, pickerOpen } = useStoreSelection();
const links = [
  { to: "/catalog", label: "Каталог" },
  { to: "/about", label: "О проекте" },
  { to: "/stores", label: "Магазины" },
  { to: "/contacts", label: "Контакты" },
];
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
    </nav>
    <p class="caption">Прохук · Каталог товаров</p></UiDialog
  >
</template>

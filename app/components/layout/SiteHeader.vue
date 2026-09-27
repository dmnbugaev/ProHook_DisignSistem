<script setup lang="ts">
const scrolled = ref(false);
const menuOpen = ref(false);
const links = [
  { href: "#identity", label: "Айдентика" },
  { href: "#typography", label: "Типографика" },
  { href: "#components", label: "Компоненты" },
  { href: "#states", label: "Состояния" },
  { href: "#motion", label: "Движение" },
];
let media: MediaQueryList | undefined;
function update() {
  if (window.scrollY > 40) scrolled.value = true;
  else if (window.scrollY < 16) scrolled.value = false;
}
function resize() {
  if (media?.matches) menuOpen.value = false;
}
onMounted(() => {
  update();
  window.addEventListener("scroll", update, { passive: true });
  media = window.matchMedia("(min-width: 1024px)");
  media.addEventListener("change", resize);
});
onBeforeUnmount(() => {
  window.removeEventListener("scroll", update);
  media?.removeEventListener("change", resize);
});
</script>
<template>
  <header class="site-header" :class="{ 'site-header--glass': scrolled }">
    <a href="#top" class="brand-link" aria-label="Прохук — в начало"
      ><img src="/brand/mark.webp" alt="" width="40" height="40" /><span
        >Дизайн-система</span
      ></a
    >
    <nav class="desktop-nav" aria-label="Разделы дизайн-системы">
      <a v-for="link in links" :key="link.href" :href="link.href">{{
        link.label
      }}</a>
    </nav>
    <UiIconButton
      class="menu-toggle"
      label="Открыть меню"
      :aria-expanded="menuOpen"
      @click="
        ($event.currentTarget as HTMLButtonElement).focus({
          preventScroll: true,
        });
        menuOpen = true;
      "
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path d="M3 8h18M3 16h18" stroke="currentColor" stroke-width="2" />
      </svg>
    </UiIconButton>
  </header>
  <UiDialog v-model="menuOpen" title="Разделы" menu>
    <nav class="mobile-nav" aria-label="Мобильная навигация">
      <a
        v-for="link in links"
        :key="link.href"
        :href="link.href"
        @click="menuOpen = false"
        >{{ link.label }}</a
      >
    </nav>
    <p class="caption">Прохук · Визуальная система</p>
  </UiDialog>
</template>

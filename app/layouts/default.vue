<script setup lang="ts">
// Memory only: a fresh document load requires a new confirmation.
const ageConfirmed = useState("age-confirmed", () => false);
const route = useRoute();
const showcase = computed(() => route.path === "/design-system");
const { data: meta } = await useCatalogMeta();
const { store, pickerOpen } = useStoreSelection();
watch(
  [ageConfirmed, meta, showcase],
  async () => {
    if (ageConfirmed.value && meta.value && !showcase.value && !store.value) {
      await nextTick();
      pickerOpen.value = true;
    }
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <div id="top" :inert="!ageConfirmed">
      <a class="skip-link" href="#main">Перейти к содержимому</a>
      <SiteHeader v-if="showcase" />
      <AppHeader v-else />
      <main id="main"><slot /></main>
      <SiteFooter v-if="showcase" />
      <AppFooter v-else />
    </div>
    <AgeGate v-model="ageConfirmed" />
    <StorePicker v-if="ageConfirmed && !showcase" />
    <noscript
      >Для подтверждения возраста 18+ и доступа к сайту включите
      JavaScript.</noscript
    >
  </div>
</template>

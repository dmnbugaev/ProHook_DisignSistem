<script setup lang="ts">
const { data: meta, error, refresh } = await useCatalogMeta();
const categories = computed(
  () =>
    meta.value?.categories.filter((item) => !item.parentId).slice(0, 6) ?? [],
);
usePageSeo(
  "Каталог товаров",
  "Товары Прохук: категории, цены и наличие в выбранном магазине.",
);
</script>
<template>
  <div>
    <HeroSection /><CategoriesSection
      v-if="meta"
      :categories="categories"
    /><UiContainer v-else-if="error" class="section"
      ><UiEmptyState title="Не удалось загрузить категории"
        >Попробуйте ещё раз.<template #action
          ><UiButton @click="refresh()">Повторить</UiButton></template
        ></UiEmptyState
      ></UiContainer
    ><PopularProductsSection /><BrandsSection
      v-if="meta"
      :categories="categories"
    /><AboutSection /><StoresSection /><ContactsSection />
  </div>
</template>

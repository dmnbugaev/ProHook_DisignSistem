<script setup lang="ts">
import type { CatalogMeta } from "~~/shared/types/catalog";

// Валидация выполняется на этапе middleware — до рендера и независимо
// от age gate: несуществующая категория обязана отвечать 404 и ботам,
// и неподтвердившим возраст посетителям (иначе мягкий 404 со статусом
// 200 из-за того, что layout не рендерит слот без подтверждения 18+).
definePageMeta({
  key: (route) => route.path,
  async validate(route) {
    const slug = String(route.params.category);
    const meta = await useRequestFetch()<CatalogMeta>("/api/catalog/meta");
    return meta.categories.some((item) => item.slug === slug)
      ? true
      : createError({ statusCode: 404, message: "Категория не найдена" });
  },
});
const route = useRoute();
</script>
<template>
  <CatalogView :category-slug="String(route.params.category)" />
</template>

<script setup lang="ts">
const props = defineProps<{ page: number; pageCount: number }>();
const route = useRoute();
const pages = computed(() =>
  [
    ...new Set([
      1,
      ...Array.from({ length: 5 }, (_, index) => props.page - 2 + index),
      props.pageCount,
    ]),
  ]
    .filter((page) => page > 0 && page <= props.pageCount)
    .sort((a, b) => a - b),
);
const link = (page: number) => ({
  path: route.path,
  query: { ...route.query, page: page === 1 ? undefined : page },
});
</script>
<template>
  <nav v-if="pageCount > 1" class="pagination" aria-label="Страницы каталога">
    <NuxtLink
      v-if="page > 1"
      :to="link(page - 1)"
      aria-label="Предыдущая страница"
      :aria-current="false"
      >←</NuxtLink
    >
    <template v-for="(number, index) in pages" :key="number">
      <span
        v-if="index > 0 && number - pages[index - 1]! > 1"
        aria-hidden="true"
        >…</span
      >
      <NuxtLink
        :to="link(number)"
        :aria-label="`Страница ${number}`"
        :aria-current="number === page ? 'page' : false"
        >{{ number }}</NuxtLink
      >
    </template>
    <NuxtLink
      v-if="page < pageCount"
      :to="link(page + 1)"
      aria-label="Следующая страница"
      :aria-current="false"
      >→</NuxtLink
    >
  </nav>
</template>

<script setup lang="ts">
const { store } = useStoreSelection();
const { data, error, status, refresh } = await useProducts(() => ({
  sort: "newest",
  limit: 4,
  storeId: store.value?.id,
}));
</script>
<template>
  <UiContainer as="section" class="section"
    ><div class="section-heading">
      <h2>Недавно обновлено.</h2>
      <NuxtLink to="/catalog" class="text-link section-heading__link"
        >Весь каталог ↗</NuxtLink
      >
    </div>
    <UiSkeleton v-if="status === 'pending'" />
    <UiEmptyState v-else-if="error" title="Коллекция временно недоступна"
      >Попробуйте загрузить ещё раз.<template #action
        ><UiButton @click="refresh()">Повторить</UiButton></template
      ></UiEmptyState
    >
    <ProductGrid v-else-if="data?.items.length" :products="data.items" />
    <UiEmptyState v-else title="Коллекция пополняется"
      >Товары появятся здесь после обновления каталога.</UiEmptyState
    >
  </UiContainer>
</template>

<script setup lang="ts">
const props = defineProps<{ initial?: string; compact?: boolean }>();
const query = ref(props.initial ?? "");
watch(
  () => props.initial,
  (value) => {
    query.value = value ?? "";
  },
);
function submit() {
  return navigateTo({
    path: "/search",
    query: query.value.trim() ? { q: query.value.trim() } : {},
  });
}
</script>
<template>
  <form
    class="search-form"
    :class="{ 'search-form--compact': compact }"
    role="search"
    @submit.prevent="submit"
  >
    <UiField
      v-model="query"
      label="Поиск по каталогу"
      type="search"
      placeholder="Название, бренд или артикул"
      maxlength="200"
    />
    <UiButton type="submit" variant="secondary">Найти</UiButton>
  </form>
</template>

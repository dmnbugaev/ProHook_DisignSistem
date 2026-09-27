<script setup lang="ts">
definePageMeta({ key: (route) => route.path });
const route = useRoute();
</script>
<template>
  <CatalogView :category-slug="String(route.params.category)" />
</template>

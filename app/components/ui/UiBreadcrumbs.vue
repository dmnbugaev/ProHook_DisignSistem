<script setup lang="ts">
defineProps<{ items: { label: string; to?: string }[] }>();
</script>
<template>
  <nav class="breadcrumbs" aria-label="Хлебные крошки">
    <ol>
      <li v-for="(item, index) in items" :key="index">
        <NuxtLink v-if="item.to" :to="item.to">{{ item.label }}</NuxtLink>
        <span v-else aria-current="page">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>

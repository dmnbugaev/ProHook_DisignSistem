<script setup lang="ts">
import type { Category } from "~~/shared/types/category";
defineProps<{ categories: Category[]; selected?: string }>();
</script>
<template>
  <nav class="category-links" aria-label="Категории каталога">
    <NuxtLink to="/catalog" :aria-current="!selected ? 'page' : undefined"
      >Все товары</NuxtLink
    >
    <NuxtLink
      v-for="category in categories"
      :key="category.id"
      :to="`/catalog/${category.slug}`"
      :aria-current="selected === category.slug ? 'page' : undefined"
      >{{ category.name }}</NuxtLink
    >
  </nav>
</template>

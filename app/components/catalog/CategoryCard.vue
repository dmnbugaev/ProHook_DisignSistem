<script setup lang="ts">
import type { Category } from "~~/shared/types/category";
defineProps<{ category: Category; index: number }>();
</script>
<template>
  <NuxtLink :to="`/catalog/${category.slug}`" class="category-card">
    <span class="category-card__number caption">0{{ index + 1 }} /</span>
    <img
      v-if="category.image"
      :src="category.image"
      alt=""
      width="480"
      height="400"
      loading="lazy"
    />
    <div>
      <h3>{{ category.name }}</h3>
      <span aria-hidden="true">↗</span>
    </div>
    <p class="caption">{{ category.description }}</p>
  </NuxtLink>
</template>

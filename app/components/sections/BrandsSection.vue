<script setup lang="ts">
import type { Category } from "~~/shared/types/category";
defineProps<{ categories: Category[] }>();
</script>
<template>
  <UiContainer as="section" class="section"
    ><div class="section-heading">
      <h2>Разные направления.<br />Один каталог.</h2>
      <p>Перейдите к нужной категории <br />или воспользуйтесь поиском.</p>
    </div>
    <div class="brand-grid">
      <NuxtLink
        v-for="(category, index) in categories"
        :key="category.id"
        :to="`/catalog/${category.slug}`"
        data-reveal
        :style="{ '--reveal-step': index % 3 }"
        >{{ category.name }}<span aria-hidden="true">↗</span></NuxtLink
      >
    </div></UiContainer
  >
</template>

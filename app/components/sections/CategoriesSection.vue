<script setup lang="ts">
import type { Category } from "~~/shared/types/category";
defineProps<{ categories: Category[] }>();
</script>
<template>
  <UiContainer as="section" class="section"
    ><div class="section-heading">
      <h2>Найдите своё.</h2>
      <p>От большого к деталям. <br />Выберите направление.</p>
    </div>
    <div class="category-grid">
      <CategoryCard
        v-for="(category, index) in categories"
        :key="category.id"
        :category="category"
        :index="index"
      /></div
  ></UiContainer>
</template>

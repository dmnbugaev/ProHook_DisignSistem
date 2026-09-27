<script setup lang="ts">
import type { Product } from "~~/shared/types/product";
defineProps<{ products: Product[]; compact?: boolean }>();
</script>
<template>
  <div class="product-grid" :class="{ 'product-grid--catalog': compact }">
    <ProductCard
      v-for="product in products"
      :key="product.id"
      :product="product"
    />
  </div>
</template>

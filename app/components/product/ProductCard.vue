<script setup lang="ts">
import type { Product } from "~~/shared/types/product";
defineProps<{ product: Product }>();
</script>
<template>
  <article class="product-card">
    <NuxtLink
      :to="`/product/${product.slug}`"
      class="product-card__visual"
      tabindex="-1"
      aria-hidden="true"
    >
      <ProductImage :image="product.images[0]" />
      <div class="product-card__badges">
        <UiBadge v-if="product.isNew" accent>Новинка</UiBadge
        ><UiBadge v-else-if="product.isPopular">Выбор коллекции</UiBadge>
      </div>
    </NuxtLink>
    <div class="product-card__body">
      <p class="caption">{{ product.categoryName ?? "Каталог" }}</p>
      <h3>
        <NuxtLink :to="`/product/${product.slug}`">{{ product.name }}</NuxtLink>
      </h3>
      <ProductAvailability :product="product" />
      <ProductPrice :product="product" />
    </div>
  </article>
</template>

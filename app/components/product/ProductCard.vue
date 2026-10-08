<script setup lang="ts">
import type { Product } from "~~/shared/types/product";
const props = defineProps<{ product: Product }>();
const { add, quantityOf } = useSelectionList();
const inList = computed(() => quantityOf(props.product.id) > 0);
const quantity = computed(() => quantityOf(props.product.id));
</script>
<template>
  <article class="product-card">
    <NuxtLink
      :to="`/product/${product.slug}`"
      class="product-card__visual"
      tabindex="-1"
      aria-hidden="true"
    >
      <ProductImage
        :image="product.images[0]"
        :restricted="product.imagesRestricted"
      />
    </NuxtLink>
    <div class="product-card__body">
      <p class="caption">{{ product.categoryName ?? "Каталог" }}</p>
      <h3>
        <NuxtLink :to="`/product/${product.slug}`">{{ product.name }}</NuxtLink>
      </h3>
      <ProductAvailability :product="product" />
      <ProductPrice :product="product" />
      <NuxtLink
        v-if="inList"
        to="/reserve"
        class="product-card__select product-card__select--active"
      >
        В списке<template v-if="quantity > 1"> · {{ quantity }}</template>
      </NuxtLink>
      <button
        v-else
        type="button"
        class="product-card__select text-link"
        @click="add(product.id)"
      >
        + В список
      </button>
    </div>
  </article>
</template>

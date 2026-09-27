<script setup lang="ts">
import type { ProductImage } from "~~/shared/types/product";
const props = defineProps<{ images: ProductImage[] }>();
const selected = ref(0);
watch(
  () => props.images,
  () => {
    selected.value = 0;
  },
);
</script>
<template>
  <div class="product-gallery">
    <ProductImage :image="images[selected]" eager />
    <div
      v-if="images.length > 1"
      class="gallery-thumbnails"
      aria-label="Изображения товара"
    >
      <button
        v-for="(image, index) in images"
        :key="image.id"
        type="button"
        :aria-pressed="selected === index"
        :aria-label="`Показать изображение ${index + 1}`"
        @click="selected = index"
      >
        <ProductImage :image="image" />
      </button>
    </div>
    <p class="caption">Изображение товара из каталога МойСклад</p>
  </div>
</template>

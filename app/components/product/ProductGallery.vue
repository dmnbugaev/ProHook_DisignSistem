<script setup lang="ts">
import type { ProductImage } from "~~/shared/types/product";
const props = defineProps<{
  images: ProductImage[];
  /** Сервер скрыл изображения: нет подтверждённого 18+. */
  restricted?: boolean;
}>();
const selected = ref(0);
watch(
  () => [props.images, props.restricted],
  () => {
    selected.value = 0;
  },
);
</script>

<template>
  <div class="product-gallery">
    <ProductImage :image="images[selected]" eager :restricted="restricted" />
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
    <p v-if="restricted" class="caption">
      Изображения товаров доступны только совершеннолетним пользователям.
    </p>
  </div>
</template>

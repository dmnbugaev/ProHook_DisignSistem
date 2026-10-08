<script setup lang="ts">
import type { ProductImage } from "~~/shared/types/product";
const props = defineProps<{
  image?: ProductImage;
  eager?: boolean;
  /** Сервер скрыл изображения: нет подтверждённого 18+. */
  restricted?: boolean;
}>();
const failed = ref(false);
watch(
  () => [props.image?.src, props.restricted],
  () => {
    failed.value = false;
  },
);
</script>

<template>
  <div class="product-image">
    <div
      v-if="restricted"
      class="image-placeholder image-placeholder--restricted"
      role="img"
      aria-label="Изображение доступно только совершеннолетним пользователям"
    >
      <span aria-hidden="true">18+</span>
      <span>Изображение доступно<br />совершеннолетним</span>
    </div>
    <img
      v-else-if="image && !failed"
      :src="image.src"
      :alt="image.alt"
      width="480"
      height="400"
      :loading="eager ? 'eager' : 'lazy'"
      @error="failed = true"
    />
    <div
      v-else
      class="image-placeholder"
      role="img"
      aria-label="Изображение отсутствует"
    >
      <span aria-hidden="true">↗</span><span>Изображение появится позже</span>
    </div>
  </div>
</template>

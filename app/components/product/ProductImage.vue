<script setup lang="ts">
import type { ProductImage } from "~~/shared/types/product";
const props = defineProps<{ image?: ProductImage; eager?: boolean }>();
const failed = ref(false);
watch(
  () => props.image?.src,
  () => {
    failed.value = false;
  },
);
</script>
<template>
  <div class="product-image">
    <img
      v-if="image && !failed"
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

<script setup lang="ts">
import type { ProductAttribute } from "~~/shared/types/product";
defineProps<{ attributes: ProductAttribute[] }>();
</script>
<template>
  <dl class="specifications">
    <div v-for="attribute in attributes" :key="attribute.code">
      <dt>{{ attribute.name }}</dt>
      <dd>{{ attribute.value }}</dd>
    </div>
  </dl>
</template>

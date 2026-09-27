<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: "Загрузка" });
</script>

<template>
  <div class="skeleton-example" :aria-label="label" role="status">
    <div class="skeleton-box" aria-hidden="true" />
    <div class="skeleton-lines" aria-hidden="true">
      <span /><span /><span />
    </div>
    <p v-if="$slots.default" class="caption"><slot /></p>
  </div>
</template>

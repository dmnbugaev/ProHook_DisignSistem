<script setup lang="ts">
defineProps<{ label: string; disabled?: boolean }>();
</script>

<template>
  <button
    type="button"
    class="icon-button"
    :aria-label="label"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

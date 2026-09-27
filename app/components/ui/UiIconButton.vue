<script setup lang="ts">
defineProps<{ label: string; disabled?: boolean }>();
</script>

<template>
  <button
    type="button"
    class="icon-button"
    :aria-label="label"
    :disabled="disabled"
    @click="
      ($event.currentTarget as HTMLButtonElement).focus({ preventScroll: true })
    "
  >
    <slot />
  </button>
</template>

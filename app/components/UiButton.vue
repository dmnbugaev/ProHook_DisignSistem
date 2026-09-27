<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "quiet";
    size?: "normal" | "large";
    disabled?: boolean;
    loading?: boolean;
    type?: "button" | "submit" | "reset";
  }>(),
  { variant: "primary", size: "normal", type: "button" },
);
</script>

<template>
  <button
    :type="type"
    class="button"
    :class="[`button--${variant}`, `button--${size}`]"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    @click="
      ($event.currentTarget as HTMLButtonElement).focus({ preventScroll: true })
    "
  >
    <span :class="{ 'button__label--loading': loading }"><slot /></span>
    <span v-if="loading" class="button__loader" aria-hidden="true">•••</span>
    <span v-if="loading" class="sr-only">Загрузка</span>
  </button>
</template>

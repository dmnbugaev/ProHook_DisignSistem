<script setup lang="ts">
defineOptions({ inheritAttrs: false });
defineProps<{ label: string; disabled?: boolean }>();
const model = defineModel<boolean>({ default: false });
</script>

<template>
  <label class="choice">
    <input
      v-model="model"
      v-bind="$attrs"
      type="checkbox"
      :disabled="disabled"
    />
    {{ label }}
  </label>
</template>

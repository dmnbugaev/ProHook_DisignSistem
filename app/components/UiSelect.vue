<script setup lang="ts">
defineOptions({ inheritAttrs: false });
defineProps<{ label: string; options: { value: string; label: string }[] }>();
const model = defineModel<string>({ default: "" });
const id = useId();
</script>
<template>
  <div class="field">
    <label :for="id" class="field__label">{{ label }}</label>
    <select :id="id" v-model="model" v-bind="$attrs">
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

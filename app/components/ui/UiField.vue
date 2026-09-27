<script setup lang="ts">
defineOptions({ inheritAttrs: false });
withDefaults(
  defineProps<{
    label: string;
    hint?: string;
    error?: string;
    multiline?: boolean;
    type?: string;
  }>(),
  { type: "text" },
);
const model = defineModel<string>({ default: "" });
const id = useId();
</script>

<template>
  <div class="field">
    <label :for="id" class="field__label">{{ label }}</label>
    <textarea
      v-if="multiline"
      :id="id"
      v-model="model"
      v-bind="$attrs"
      rows="3"
      :aria-invalid="!!error"
      :aria-describedby="error || hint ? `${id}-help` : undefined"
    />
    <input
      v-else
      :id="id"
      v-model="model"
      v-bind="$attrs"
      :type="type"
      :aria-invalid="!!error"
      :aria-describedby="error || hint ? `${id}-help` : undefined"
    />
    <p
      v-if="error || hint"
      :id="`${id}-help`"
      class="field__help"
      :class="{ 'field__help--error': error }"
      :role="error ? 'alert' : undefined"
    >
      {{ error ? `! ${error}` : hint }}
    </p>
  </div>
</template>

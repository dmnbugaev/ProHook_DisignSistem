<script setup lang="ts">
withDefaults(
  defineProps<{ as?: "div" | "section" | "article" | "nav" | "footer" }>(),
  { as: "div" },
);
</script>

<template>
  <component :is="as" class="container"><slot /></component>
</template>

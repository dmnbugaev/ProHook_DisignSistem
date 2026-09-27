<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <div class="state-example">
    <slot name="icon" />
    <h3>{{ title }}</h3>
    <p><slot /></p>
    <slot name="action" />
  </div>
</template>

<script setup lang="ts">
defineProps<{ accent?: boolean }>();
</script>
<template>
  <span class="badge" :class="{ 'badge--accent': accent }"><slot /></span>
</template>

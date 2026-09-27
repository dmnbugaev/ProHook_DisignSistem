<script setup lang="ts">
defineProps<{
  title: string;
  href: string;
  image: string;
  imageAlt: string;
  label?: string;
}>();
</script>
<template>
  <article class="info-card">
    <div class="info-card__image">
      <img
        :src="image"
        :alt="imageAlt"
        width="400"
        height="400"
        loading="lazy"
      />
    </div>
    <div class="info-card__content">
      <span v-if="label" class="caption">{{ label }}</span>
      <h3>
        <a :href="href">{{ title }}</a>
      </h3>
      <p><slot /></p>
    </div>
  </article>
</template>

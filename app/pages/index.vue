<script setup lang="ts">
definePageMeta({ alias: ["/design-system"] });
useSeoMeta({
  title: "Прохук — дизайн-система",
  description:
    "Визуальный язык Прохук: айдентика, типографика, компоненты и движение.",
  ogTitle: "Прохук — дизайн-система",
  ogDescription:
    "Утверждённая визуальная система Прохук и интерактивные примеры компонентов.",
  ogImage: "/brand/lockup.webp",
});
</script>
<template>
  <div>
    <DesignHero />
    <DesignIdentity />
    <DesignTypography />
    <DesignComponents />
    <DesignStates />
    <DesignMotion />
  </div>
</template>

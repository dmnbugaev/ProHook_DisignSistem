<script setup lang="ts">
const visible = ref(true);
</script>

<template>
  <aside
    v-if="visible"
    class="legal-notice"
    aria-label="Важная информация о сайте"
  >
    <div class="legal-notice__content">
      <span class="legal-notice__symbol" aria-hidden="true">!</span>
      <p>
        Не публичная оферта. Продажа и оплата — только в магазинах сети, 18+.
        Никотин вызывает зависимость и вредит здоровью.
        <NuxtLink to="/information">Подробнее</NuxtLink>.
      </p>
      <button
        type="button"
        class="legal-notice__close"
        aria-label="Закрыть юридическую информацию"
        @click="visible = false"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  </aside>
</template>

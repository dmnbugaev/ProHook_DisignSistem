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
        Информация на сайте носит ознакомительный характер и не является
        публичной офертой. Продажа и оплата товаров через сайт не
        осуществляются. Сайт предназначен для лиц старше 18 лет. Никотин
        вызывает зависимость и вредит здоровью. Подробнее —
        <NuxtLink to="/information">в информации о сайте</NuxtLink>.
      </p>
      <button
        type="button"
        class="legal-notice__close"
        aria-label="Закрыть юридическую информацию"
        @click="visible = false"
      >
        Закрыть
      </button>
    </div>
  </aside>
</template>

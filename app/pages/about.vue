<script setup lang="ts">
usePageSeo(
  "О проекте",
  "Прохук — локальный каталог товаров с поиском, ценами и наличием по магазинам.",
);
</script>
<template>
  <div>
    <UiContainer class="page-shell"
      ><UiBreadcrumbs
        :items="[{ label: 'Главная', to: '/' }, { label: 'О проекте' }]"
      />
      <div class="page-heading">
        <p class="eyebrow">Прохук / О проекте</p>
        <h1>У каждой детали<br />есть смысл.</h1>
        <p>
          Локальный каталог с товарами из МойСклад, поиском и выбором магазина.
        </p>
      </div>
      <div class="about-editorial">
        <img src="/brand/lockup.webp" alt="Прохук" width="360" height="360" />
        <div>
          <h2>От идеи —<br />к целой системе.</h2>
          <p>
            Этот проект создан для портфолио. Его основа — белое пространство,
            чёрная типографика, жёлтый акцент и оригинальная айдентика.
          </p>
          <p>
            Товары, цены и наличие загружаются из МойСклад. Можно изучить
            категории, найти товар и выбрать магазин.
          </p>
          <NuxtLink to="/design-system" class="text-link"
            >Посмотреть дизайн-систему ↗</NuxtLink
          >
        </div>
      </div></UiContainer
    ><AboutSection /><ContactsSection />
  </div>
</template>

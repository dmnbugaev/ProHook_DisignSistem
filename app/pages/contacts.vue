<script setup lang="ts">
usePageSeo(
  "Контакты",
  "Контактная информация Прохук. Подтверждённые каналы связи будут добавлены позже.",
);
</script>
<template>
  <UiContainer class="page-shell"
    ><UiBreadcrumbs
      :items="[{ label: 'Главная', to: '/' }, { label: 'Контакты' }]"
    />
    <div class="page-heading">
      <p class="eyebrow">Прохук / Контакты</p>
      <h1>Начнём<br />с разговора.</h1>
      <p>
        Проект для портфолио. Подтверждённые контактные данные пока не
        предоставлены.
      </p>
    </div>
    <div class="contact-grid">
      <section>
        <h2>Связаться с нами</h2>
        <dl class="specifications">
          <div>
            <dt>Телефон</dt>
            <dd>Будет добавлен</dd>
          </div>
          <div>
            <dt>Электронная почта</dt>
            <dd>Будет добавлена</dd>
          </div>
          <div>
            <dt>Социальные сети</dt>
            <dd>Ссылки появятся позже</dd>
          </div>
        </dl>
      </section>
      <section>
        <h2>Наши пространства</h2>
        <p>
          Выберите город и магазин, чтобы посмотреть цену и наличие товаров.
        </p>
        <NuxtLink to="/stores" class="button button--secondary"
          >Смотреть магазины ↗</NuxtLink
        >
      </section>
    </div></UiContainer
  >
</template>

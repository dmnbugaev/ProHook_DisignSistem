<script setup lang="ts">
// Ключевая бизнес-модель сайта в трёх шагах: сайт — справочный каталог,
// покупка только офлайн (15-ФЗ, см. docs/COMPLIANCE.md). Секция объясняет
// сценарий до того, как пользователь дошёл до списка выбранных товаров
// (порт секции «Как это работает» с сайта Бункера, тексты той же модели).
const steps = [
  {
    number: "01",
    title: "Выберите магазин",
    text: "Цены и наличие в каталоге зависят от точки: выберите удобный магазин сети.",
  },
  {
    number: "02",
    title: "Соберите список",
    text: "Добавьте товары в список выбранных и отправьте запрос на резерв — магазин держит товары 12 часов.",
  },
  {
    number: "03",
    title: "Заберите на кассе",
    text: "Оплата и выдача — в магазине после проверки совершеннолетия по документу.",
  },
] as const;
</script>
<template>
  <UiContainer as="section" class="section"
    ><div class="section-heading">
      <h2>Резерв — просто.</h2>
      <p>Три шага от каталога до покупки в магазине.</p>
    </div>
    <ol class="advantages how-it-works__steps">
      <li
        v-for="(step, index) in steps"
        :key="step.number"
        data-reveal
        :style="{ '--reveal-step': index }"
      >
        <span class="caption">{{ step.number }}</span>
        <h3>{{ step.title }}</h3>
        <p>{{ step.text }}</p>
      </li>
    </ol>
    <div class="inline-actions how-it-works__actions">
      <NuxtLink to="/catalog" class="button button--primary"
        >Перейти в каталог <UiArrow
      /></NuxtLink>
      <NuxtLink to="/stores" class="button button--secondary"
        >Выбрать магазин <UiArrow
      /></NuxtLink>
    </div>
  </UiContainer>
</template>
<style scoped>
/* Нумерованный список шагов поверх сетки .advantages: маркеры ol не нужны,
   номер шага — подпись caption внутри пункта. */
.how-it-works__steps {
  list-style: none;
  padding: 0;
}
.how-it-works__steps .caption {
  color: var(--ink);
  font-weight: var(--weight-medium);
}
.how-it-works__actions {
  margin-top: var(--space-8);
}
</style>

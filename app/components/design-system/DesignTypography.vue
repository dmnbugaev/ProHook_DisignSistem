<script setup lang="ts">
const typeRows = [
  {
    name: "Display",
    size: "88 / 88 · 800",
    text: "Характер",
    class: "display",
  },
  {
    name: "Заголовок H1",
    size: "56 / 60 · 700",
    text: "Ясная форма",
    class: "h1",
  },
  {
    name: "Заголовок H2",
    size: "40 / 44 · 700",
    text: "Внимание к деталям",
    class: "h2",
  },
  {
    name: "Заголовок H3",
    size: "24 / 30 · 600",
    text: "Всё на своём месте",
    class: "h3",
  },
  {
    name: "Основной текст",
    size: "16 / 24 · 400",
    text: "Пространство помогает увидеть главное. Текст объясняет, что можно сделать дальше.",
    class: "body",
  },
  {
    name: "Подпись",
    size: "14 / 20 · 400",
    text: "Небольшая деталь — часть общей системы.",
    class: "caption",
  },
];
</script>
<template>
  <UiContainer
    as="section"
    id="typography"
    class="section"
    aria-labelledby="type-title"
  >
    <div class="section-heading">
      <h2 id="type-title">Слова имеют вес</h2>
      <p>
        Golos Text. Уверенный в заголовках,<br />
        спокойный в длинном тексте.
      </p>
    </div>
    <div class="type-intro">
      <span class="type-intro__letters" aria-hidden="true">Аа</span>
      <div>
        <h3>Golos Text</h3>
        <p>
          АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ<br />
          abcdefghijklmnopqrstuvwxyz<br />
          0123456789 !?&@
        </p>
        <div class="weight-labels">
          <span>Regular 400</span><span>Medium 500</span><span>Bold 700</span
          ><span>ExtraBold 800</span>
        </div>
      </div>
    </div>
    <div class="type-scale">
      <div v-for="row in typeRows" :key="row.name" class="type-row">
        <div class="type-row__meta">
          <span>{{ row.name }}</span
          ><span class="caption">{{ row.size }}</span>
        </div>
        <p :class="`sample-${row.class}`">{{ row.text }}</p>
      </div>
    </div>
    <p class="caption section-footnote">
      Размер / интерлиньяж в px · насыщенность. На телефоне шкала адаптируется:
      Display 44 / 46, H1 36 / 40, H2 28 / 32.
    </p>
  </UiContainer>
</template>

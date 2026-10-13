<script setup lang="ts">
// Ненавязчивое подтверждение 18+ на страницах каталога (решение владельца
// 13.10.2026): страница уже показывает общедоступный ассортимент, кнопка
// открывает остальной каталог без перезагрузки — подтверждение пишется
// в cookie через watch в layouts/default.vue, страницы рефрешат данные.
const ageConfirmed = useAgeConfirmed();
withDefaults(
  defineProps<{
    /** Заголовок блока; по умолчанию — про неполный каталог. */
    title?: string;
    text?: string;
  }>(),
  {
    title: "В каталоге есть товары для лиц 18+",
    text: "Сейчас показаны общедоступные товары. Полный ассортимент — после подтверждения совершеннолетнего возраста.",
  },
);
</script>

<template>
  <div v-if="!ageConfirmed" class="age-notice" role="note">
    <div class="age-notice__body">
      <span class="age-notice__badge" aria-hidden="true">18+</span>
      <div class="age-notice__text">
        <p class="age-notice__title">{{ title }}</p>
        <p>{{ text }}</p>
      </div>
    </div>
    <UiButton @click="ageConfirmed = true">Мне 18 лет или больше</UiButton>
  </div>
</template>

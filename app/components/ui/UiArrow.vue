<!-- Диагональная стрелка «наружу» для ссылок и кнопок: наследует currentColor
     и размер шрифта (0.8em). Замена текстовому глифу «↗», который в разных
     шрифтах прыгает по базовой линии и рвёт выравнивание (правка 19.11.2026). -->
<template>
  <svg class="ui-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M4.6 11.4 11.4 4.6M5.4 4.6h6v6"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
<style scoped>
.ui-arrow {
  display: inline-block;
  width: 0.8em;
  height: 0.8em;
  flex: none;
  vertical-align: -0.06em;
  transition: transform var(--duration-fast) ease;
}
</style>

<script setup lang="ts">
const messages = ["Курение убивает", "Только для совершеннолетних"];
// Группа должна быть шире самого большого вьюпорта (~3840px),
// иначе на широких экранах в строке появляются пустые провалы.
const repeats = 8;
const items = Array.from({ length: repeats }, () => messages).flat();
</script>

<template>
  <div class="age-marquee">
    <p class="sr-only">18+. Курение убивает. Только для совершеннолетних.</p>
    <div class="age-marquee__track" aria-hidden="true">
      <div v-for="copy in 2" :key="copy" class="age-marquee__group">
        <span
          v-for="(message, index) in items"
          :key="index"
          class="age-marquee__item"
        >
          <span class="age-marquee__badge">18+</span>
          <span>{{ message }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

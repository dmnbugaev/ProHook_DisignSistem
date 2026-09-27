<script setup lang="ts">
import type { NuxtError } from "#app";
const props = defineProps<{ error: NuxtError }>();
const is404 = computed(() => props.error.statusCode === 404);
useSeoMeta({
  title: () =>
    is404.value ? "Страница не найдена — Прохук" : "Ошибка — Прохук",
  robots: "noindex, nofollow",
});
</script>
<template>
  <main class="page-shell container error-page">
    <img src="/brand/mark.webp" alt="Прохук" width="48" height="48" />
    <p class="eyebrow">{{ error.statusCode }}</p>
    <h1>{{ is404 ? "Здесь пока пусто." : "Не удалось открыть страницу." }}</h1>
    <p>
      {{
        is404
          ? "Возможно, адрес изменился или такого предмета нет в коллекции."
          : "Попробуйте вернуться на главную и повторить действие."
      }}
    </p>
    <UiButton @click="clearError({ redirect: '/' })">На главную ↗</UiButton>
  </main>
</template>

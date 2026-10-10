<script setup lang="ts">
/**
 * Баннер согласия на использование файлов cookie (152-ФЗ): краткое
 * уведомление, «Принять» (включая аналитику) и «×» (закрыть —
 * сохраняется отказ, работают только необходимые cookie).
 *
 * Повторно открывается кнопкой «Файлы cookie» в футере тем же
 * интерфейсом — «Принять» даёт/возвращает согласие, «×» отзывает
 * (удаление идентификаторов Метрики и перезагрузка — см.
 * composables/useConsentSettings.ts). Категории и юридические
 * формулировки — /privacy#cookies.
 */
const { needsDecision, settingsOpen, saveConsent } = useConsentSettings();
const visible = computed(() => needsDecision.value || settingsOpen.value);
const panel = ref<HTMLElement | null>(null);

// Повторное открытие из футера: переносим фокус на баннер — клик ушёл
// с нижней части страницы.
watch(settingsOpen, (open) => {
  if (!open) return;
  void nextTick(() => panel.value?.focus());
});
</script>

<template>
  <div
    v-if="visible"
    ref="panel"
    class="cookie-consent"
    role="region"
    aria-label="Использование файлов cookie"
    tabindex="-1"
  >
    <div class="cookie-consent__body">
      <svg
        class="cookie-consent__icon"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M8.5 8.5v.01M12 12v.01M7.5 14v.01M11 17v.01M16 15.5v.01"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
        />
      </svg>
      <p class="cookie-consent__text">
        Мы используем файлы cookie: необходимые — для работы сайта,
        аналитические (Яндекс Метрика) — только с вашего согласия.
        <NuxtLink to="/privacy#cookies">Подробнее</NuxtLink>.
      </p>
    </div>
    <div class="cookie-consent__actions">
      <UiButton @click="saveConsent(true)">Принять</UiButton>
      <UiIconButton label="Закрыть" @click="saveConsent(false)"
        ><span aria-hidden="true">×</span></UiIconButton
      >
    </div>
  </div>
</template>

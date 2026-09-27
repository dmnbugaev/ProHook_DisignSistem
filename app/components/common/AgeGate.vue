<script setup lang="ts">
const confirmed = defineModel<boolean>({ required: true });
const open = computed(() => !confirmed.value);
const declined = ref(false);
</script>

<template>
  <UiDialog
    :model-value="open"
    title="Вам уже исполнилось 18 лет?"
    :dismissible="false"
  >
    <p v-if="declined" role="status">
      Доступ к сайту разрешён только посетителям от 18 лет.
    </p>
    <p v-else>Для продолжения подтвердите, что вам 18 лет или больше.</p>
    <div class="dialog__actions">
      <template v-if="!declined">
        <UiButton @click="confirmed = true">Мне 18 лет или больше</UiButton>
        <UiButton variant="secondary" @click="declined = true"
          >Мне нет 18 лет</UiButton
        >
      </template>
      <UiButton v-else variant="secondary" @click="declined = false"
        >Вернуться к подтверждению</UiButton
      >
    </div>
  </UiDialog>
</template>

<script setup lang="ts">
const state = ref("empty");
</script>
<template>
  <UiContainer
    as="section"
    id="states"
    class="section"
    aria-labelledby="states-title"
  >
    <div class="section-heading">
      <h2 id="states-title">
        Ясность в любом<br />
        состоянии
      </h2>
      <p>
        Даже когда данных нет,<br />
        следующий шаг остаётся понятным.
      </p>
    </div>
    <UiTabs
      v-model="state"
      label="Служебные состояния"
      :tabs="[
        { value: 'empty', label: 'Пусто' },
        { value: 'error', label: 'Ошибка' },
        { value: 'loading', label: 'Загрузка' },
      ]"
      ><template #empty
        ><UiEmptyState title="Здесь пока ничего нет"
          ><template #icon
            ><svg
              width="56"
              height="56"
              viewBox="0 0 56 56"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M9 18h38v29H9zM17 9h22v9H17zM21 29h14"
                stroke="currentColor"
                stroke-width="2"
              /></svg
          ></template>
          Это пример пустого списка.<br />
          Посмотрите, как выглядят другие состояния.
          <template #action
            ><UiButton variant="secondary" @click="state = 'error'"
              >Показать ошибку</UiButton
            ></template
          ></UiEmptyState
        ></template
      ><template #error
        ><UiEmptyState title="Не удалось загрузить пример"
          ><template #icon
            ><span class="state-symbol" aria-hidden="true">!</span></template
          >
          Демонстрация ошибки соединения.<br />
          Кнопка ниже переключит образец на загрузку.
          <template #action
            ><UiButton variant="secondary" @click="state = 'loading'"
              >Повторить</UiButton
            ></template
          ></UiEmptyState
        ></template
      ><template #loading
        ><UiSkeleton label="Пример загрузки">
          Статичный skeleton сохраняет место для содержимого.
        </UiSkeleton></template
      ></UiTabs
    >
  </UiContainer>
</template>

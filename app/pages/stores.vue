<script setup lang="ts">
const { data: meta, error, refresh } = await useCatalogMeta();
const { store, select, pickerOpen } = useStoreSelection();
usePageSeo(
  "Магазины",
  "Магазины Прохук. Выберите точку для просмотра цены и наличия товаров.",
);
</script>
<template>
  <UiContainer class="page-shell"
    ><UiBreadcrumbs
      :items="[{ label: 'Главная', to: '/' }, { label: 'Магазины' }]"
    />
    <div class="page-heading">
      <p class="eyebrow">Прохук / Пространства</p>
      <h1>Ваш город.<br />Ваш магазин.</h1>
      <p>
        Выберите точку для просмотра цены и наличия. Названия точек получены из
        МойСклад; адрес указан там, где он заполнен.
      </p>
    </div>
    <UiButton variant="secondary" @click="pickerOpen = true"
      >Выбрать город и магазин</UiButton
    ><UiEmptyState v-if="error" title="Не удалось загрузить магазины"
      >Попробуйте ещё раз.<template #action
        ><UiButton @click="refresh()">Повторить</UiButton></template
      ></UiEmptyState
    >
    <section v-for="city in meta?.cities" :key="city.id" class="store-city">
      <h2>{{ city.name }}</h2>
      <div class="store-grid">
        <article
          v-for="item in meta?.stores.filter(
            (value) => value.cityId === city.id,
          )"
          :key="item.id"
          class="store-card"
        >
          <UiBadge>Магазин</UiBadge>
          <h3>{{ item.name }}</h3>
          <p>{{ item.description }}</p>
          <p class="caption">
            {{ item.address ?? "Адрес появится позже" }}<br />{{
              item.hours ?? "Время работы уточняется"
            }}
          </p>
          <UiButton
            variant="secondary"
            :disabled="store?.id === item.id"
            @click="select(item.id)"
            >{{
              store?.id === item.id
                ? "Выбран этот магазин"
                : "Выбрать эту точку"
            }}</UiButton
          >
        </article>
      </div>
    </section></UiContainer
  >
</template>

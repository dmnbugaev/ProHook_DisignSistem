<script setup lang="ts">
const { store, city, pickerOpen } = useStoreSelection();
</script>
<template>
  <UiContainer as="section" class="section"
    ><div class="section-heading">
      <h2>Ближе к вам.</h2>
      <p>Выберите город и точку, <br />чтобы посмотреть её коллекцию.</p>
    </div>
    <div class="store-feature">
      <div>
        <span class="caption">{{ city?.name ?? "Ваш город" }}</span>
        <h3>{{ store?.name ?? "Начните с магазина" }}</h3>
        <p>Выберите точку, чтобы узнать наличие товаров в этом магазине.</p>
      </div>
      <div class="inline-actions">
        <UiButton variant="secondary" @click="pickerOpen = true">{{
          store ? "Изменить магазин" : "Выбрать магазин"
        }}</UiButton
        ><NuxtLink to="/stores" class="text-link">Все магазины ↗</NuxtLink>
      </div>
    </div></UiContainer
  >
</template>

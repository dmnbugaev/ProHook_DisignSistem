<script setup lang="ts">
const { data: meta, error, refresh, status } = await useCatalogMeta();
const { store, pickerOpen, select } = useStoreSelection();
const cityId = ref("");
const chosen = ref("");
const stores = computed(
  () => meta.value?.stores.filter((item) => item.cityId === cityId.value) ?? [],
);
const cityOptions = computed(() => [
  { value: "", label: "Выберите город" },
  ...(meta.value?.cities.map((city) => ({
    value: city.id,
    label: city.name,
  })) ?? []),
]);
watch(
  pickerOpen,
  (open) => {
    if (open) {
      cityId.value = store.value?.cityId ?? "";
      chosen.value = store.value?.id ?? "";
    }
  },
  { immediate: true },
);
watch(cityId, () => {
  if (!stores.value.some((item) => item.id === chosen.value)) chosen.value = "";
});
</script>
<template>
  <UiDialog
    v-model="pickerOpen"
    title="Ваш город и магазин"
    :dismissible="!!store"
  >
    <p class="caption">Цена зависит от города, наличие — от выбранной точки.</p>
    <UiEmptyState v-if="error" title="Не удалось загрузить магазины">
      Попробуйте ещё раз.<template #action
        ><UiButton :loading="status === 'pending'" @click="refresh()"
          >Повторить</UiButton
        ></template
      >
    </UiEmptyState>
    <form v-else class="store-picker" @submit.prevent="select(chosen)">
      <UiSelect v-model="cityId" label="Город" :options="cityOptions" />
      <fieldset v-if="cityId" class="store-options">
        <legend>Магазин</legend>
        <label
          v-for="item in stores"
          :key="item.id"
          class="store-option"
          :class="{ 'store-option--selected': chosen === item.id }"
        >
          <input v-model="chosen" type="radio" name="store" :value="item.id" />
          <span
            ><strong>{{ item.name }}</strong
            ><span class="caption">{{ item.description }}</span></span
          >
        </label>
      </fieldset>
      <UiButton type="submit" :disabled="!chosen">Выбрать магазин</UiButton>
    </form>
  </UiDialog>
</template>

<script setup lang="ts">
import type { FilterValues } from "~/composables/useCatalogQuery";

const props = defineProps<{ values: FilterValues }>();
const emit = defineEmits<{
  apply: [value: Partial<FilterValues>];
  reset: [];
}>();
// Черновик нужен только для текстовых полей цены: чекбоксы применяются
// сразу, а ввод в «От»/«До» копится с дебаунсом, чтобы URL не дёргался
// на каждую цифру.
const draft = ref({
  minPrice: props.values.minPrice,
  maxPrice: props.values.maxPrice,
});
// Синхронизация только по значениям: объект values пересоздаётся при любом
// изменении query (например, ?page=2), и вотчер по ссылке затирал бы черновик,
// а следом debounced emit «apply» сбрасывал страницу каталога обратно на 1.
watch(
  () => [props.values.minPrice, props.values.maxPrice] as const,
  ([minPrice, maxPrice]) => {
    draft.value = { minPrice, maxPrice };
  },
);
const invalid = computed(
  () =>
    !!draft.value.minPrice &&
    !!draft.value.maxPrice &&
    Number(draft.value.minPrice) > Number(draft.value.maxPrice),
);
let timer: ReturnType<typeof setTimeout> | undefined;
function pushPrice() {
  if (invalid.value) return;
  // Эхо от собственной синализации из URL не эмитим повторно.
  if (
    draft.value.minPrice === props.values.minPrice &&
    draft.value.maxPrice === props.values.maxPrice
  )
    return;
  emit("apply", { ...draft.value });
}
watch(
  draft,
  () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(pushPrice, 400);
  },
  { deep: true },
);
onBeforeUnmount(() => timer && clearTimeout(timer));
</script>
<template>
  <div class="catalog-filters">
    <fieldset>
      <legend>Цена, ₽</legend>
      <div class="price-fields">
        <UiField
          v-model="draft.minPrice"
          label="От"
          type="number"
          inputmode="numeric"
          min="0"
          max="10000000"
          step="1"
          placeholder="0"
        /><UiField
          v-model="draft.maxPrice"
          label="До"
          type="number"
          inputmode="numeric"
          min="0"
          max="10000000"
          step="1"
          placeholder="Любая"
        />
      </div>
      <p v-if="invalid" class="field__help" role="alert">
        Цена «До» должна быть не меньше цены «От».
      </p>
    </fieldset>
    <UiCheckbox
      :model-value="values.available"
      label="Только в наличии"
      @update:model-value="emit('apply', { available: $event })"
    />
    <UiCheckbox
      :model-value="values.photo"
      label="Только с фотографией"
      @update:model-value="emit('apply', { photo: $event })"
    />
    <div class="filter-actions">
      <UiButton variant="quiet" @click="emit('reset')"
        >Сбросить фильтры</UiButton
      >
    </div>
  </div>
</template>

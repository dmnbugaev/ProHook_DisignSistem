<script setup lang="ts">
import type { CatalogMeta } from "~~/shared/types/catalog";
import type { FilterValues } from "~/composables/useCatalogQuery";
const props = defineProps<{ meta: CatalogMeta; values: FilterValues }>();
const emit = defineEmits<{ apply: [value: FilterValues]; reset: [] }>();
const draft = ref<FilterValues>({ ...props.values });
watch(
  () => props.values,
  (value) => {
    draft.value = { ...value };
  },
  { deep: true },
);
const invalid = computed(
  () =>
    !!draft.value.minPrice &&
    !!draft.value.maxPrice &&
    Number(draft.value.minPrice) > Number(draft.value.maxPrice),
);
</script>
<template>
  <form
    class="catalog-filters"
    @submit.prevent="!invalid && emit('apply', draft)"
  >
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
    <UiCheckbox v-model="draft.available" label="Только в наличии" />
    <div class="filter-actions">
      <UiButton type="submit" :disabled="invalid">Применить</UiButton
      ><UiButton variant="quiet" @click="emit('reset')"
        >Сбросить фильтры</UiButton
      >
    </div>
  </form>
</template>

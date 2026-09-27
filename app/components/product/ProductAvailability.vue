<script setup lang="ts">
import type { Product } from "~~/shared/types/product";
import { getOffer, availabilityLabels } from "~~/shared/utils/product";
const props = defineProps<{ product: Product }>();
const { store } = useStoreSelection();
const offer = computed(() =>
  store.value ? getOffer(props.product, store.value.id) : undefined,
);
</script>
<template>
  <p
    class="availability"
    :class="{
      'availability--yes': offer && offer.availability !== 'unavailable',
    }"
  >
    <span aria-hidden="true" />{{
      store
        ? offer
          ? availabilityLabels[offer.availability]
          : "Товар не представлен в этом городе"
        : "Выберите магазин"
    }}
  </p>
</template>

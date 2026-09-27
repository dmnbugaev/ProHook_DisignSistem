<script setup lang="ts">
import type { Product } from "~~/shared/types/product";
import { getOffer, formatPrice } from "~~/shared/utils/product";
const props = defineProps<{ product: Product }>();
const { store } = useStoreSelection();
const offer = computed(() =>
  store.value ? getOffer(props.product, store.value.id) : undefined,
);
const lowest = computed(() =>
  props.product.offers.length
    ? Math.min(...props.product.offers.map((item) => item.price))
    : undefined,
);
</script>
<template>
  <div class="product-price">
    <template v-if="offer"
      ><strong>{{ formatPrice(offer.price) }}</strong
      ><del v-if="offer.oldPrice && offer.oldPrice > offer.price"
        ><span class="sr-only">Прежняя цена </span
        >{{ formatPrice(offer.oldPrice) }}</del
      ></template
    >
    <strong v-else-if="!store && lowest !== undefined"
      >от {{ formatPrice(lowest) }}</strong
    >
    <span v-else class="caption">Нет цены для выбранного города</span>
  </div>
</template>

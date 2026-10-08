<script setup lang="ts">
import type { Product } from "~~/shared/types/product";
const props = defineProps<{ product: Product }>();
const { add, quantityOf } = useSelectionList();
const { store } = useStoreSelection();
const inList = computed(() => quantityOf(props.product.id) > 0);
const quantity = computed(() => quantityOf(props.product.id));
/**
 * Нулевой остаток в выбранном магазине (или во всей сети, пока магазин не
 * выбран): такие позиции остаются в каталоге с меткой «Скоро в наличии»,
 * когда фильтр наличия снят.
 */
const soldOut = computed(() => {
  const selected = store.value;
  const offers = selected
    ? props.product.offers.filter((offer) => offer.storeId === selected.id)
    : props.product.offers;
  return (
    offers.length > 0 &&
    !offers.some(
      (offer) =>
        offer.availability === "available" || offer.availability === "low",
    )
  );
});
</script>
<template>
  <article class="product-card">
    <NuxtLink
      :to="`/product/${product.slug}`"
      class="product-card__visual"
      tabindex="-1"
      aria-hidden="true"
    >
      <ProductImage
        :image="product.images[0]"
        :restricted="product.imagesRestricted"
      />
      <span v-if="soldOut" class="badge product-card__soon">
        Скоро в наличии
      </span>
    </NuxtLink>
    <div class="product-card__body">
      <p class="caption product-card__category">
        {{ product.categoryName ?? "Каталог" }}
      </p>
      <h3 class="product-card__name">
        <NuxtLink :to="`/product/${product.slug}`">{{ product.name }}</NuxtLink>
      </h3>
      <ProductAvailability :product="product" />
      <ProductPrice :product="product" />
      <NuxtLink
        v-if="inList"
        to="/reserve"
        class="product-card__select product-card__select--active"
      >
        В списке<template v-if="quantity > 1"> · {{ quantity }}</template>
      </NuxtLink>
      <button
        v-else
        type="button"
        class="product-card__select text-link"
        @click="add(product.id)"
      >
        + В список
      </button>
    </div>
  </article>
</template>

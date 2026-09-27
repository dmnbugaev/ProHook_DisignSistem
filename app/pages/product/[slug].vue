<script setup lang="ts">
import { availabilityLabels, formatPrice } from "~~/shared/utils/product";
definePageMeta({ key: (route) => route.path });
const route = useRoute();
const {
  data: product,
  error,
  refresh,
  status,
} = await useProduct(() => String(route.params.slug));
if (error.value?.statusCode === 404)
  throw createError({
    statusCode: 404,
    statusMessage: "Not Found",
    message: "Товар не найден",
  });
const { data: meta } = await useCatalogMeta();
const { store, pickerOpen } = useStoreSelection();
const category = computed(() =>
  meta.value?.categories.find((item) => item.id === product.value?.categoryId),
);
const { data: related } = await useProducts(() => ({
  category: category.value?.slug,
  excludeId: product.value?.id,
  storeId: store.value?.id,
  limit: 4,
}));
const breadcrumbs = computed(() => [
  { label: "Главная", to: "/" },
  { label: "Каталог", to: "/catalog" },
  ...(category.value
    ? [{ label: category.value.name, to: `/catalog/${category.value.slug}` }]
    : []),
  { label: product.value?.name ?? "Товар" },
]);
usePageSeo(
  () => product.value?.name ?? "Товар",
  () => product.value?.description ?? "Товар из каталога Прохук.",
  () => product.value?.images[0]?.src ?? "/brand/lockup.webp",
);
</script>
<template>
  <UiContainer class="page-shell">
    <UiBreadcrumbs :items="breadcrumbs" />
    <UiSkeleton v-if="status === 'pending'" />
    <UiEmptyState
      v-else-if="error || !product"
      title="Не удалось загрузить товар"
      >Попробуйте снова.<template #action
        ><UiButton @click="refresh()">Повторить</UiButton></template
      ></UiEmptyState
    >
    <template v-else>
      <div class="product-detail">
        <ProductGallery :images="product.images" />
        <div class="product-detail__info">
          <p class="eyebrow">
            {{ product.categoryName ?? "Каталог" }} / {{ product.sku }}
          </p>
          <h1>{{ product.name }}</h1>
          <div class="product-detail__badges">
            <UiBadge v-if="product.isNew" accent>Новинка</UiBadge
            ><UiBadge v-if="product.isPopular">Выбор коллекции</UiBadge>
          </div>
          <ProductPrice :product="product" /><ProductAvailability
            :product="product"
          />
          <div class="product-store">
            <p class="caption">
              {{ store?.name ?? "Выберите магазин для проверки наличия" }}
            </p>
            <button type="button" class="text-link" @click="pickerOpen = true">
              {{ store ? "Изменить магазин" : "Выбрать магазин" }}
            </button>
          </div>
          <ProductSpecifications :attributes="product.attributes" />
        </div>
      </div>
      <section class="product-description">
        <h2>О товаре</h2>
        <p>{{ product.description }}</p>
      </section>
      <section class="product-offers">
        <h2>По магазинам</h2>
        <p class="caption">Цена зависит от города, наличие — от магазина.</p>
        <ul>
          <li v-for="offer in product.offers" :key="offer.storeId">
            <span>{{
              meta?.stores.find((item) => item.id === offer.storeId)?.name ??
              "Магазин"
            }}</span
            ><span>{{ availabilityLabels[offer.availability] }}</span
            ><strong>{{ formatPrice(offer.price) }}</strong>
          </li>
        </ul>
      </section>
      <section v-if="related?.items.length" class="section">
        <div class="section-heading">
          <h2>Рядом по характеру.</h2>
          <NuxtLink
            :to="`/catalog/${category?.slug ?? ''}`"
            class="text-link section-heading__link"
            >Вся категория ↗</NuxtLink
          >
        </div>
        <ProductGrid :products="related.items" />
      </section>
    </template>
  </UiContainer>
</template>

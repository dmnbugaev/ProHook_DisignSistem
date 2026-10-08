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
const { add, remove, quantityOf } = useSelectionList();
const inList = computed(
  () => product.value && quantityOf(product.value.id) > 0,
);
const category = computed(() =>
  meta.value?.categories.find((item) => item.id === product.value?.categoryId),
);
const { data: related } = await useProducts(() => ({
  category: category.value?.slug,
  excludeId: product.value?.id,
  storeId: store.value?.id,
  limit: 4,
}));
// «Предыдущий / Следующий товар» — по выдаче категории в том же порядке,
// в котором пользователь видел её в каталоге.
const { data: adjacent } = await useFetch<{
  prev: { slug: string; name: string } | null;
  next: { slug: string; name: string } | null;
}>(
  () =>
    `/api/products/${encodeURIComponent(String(route.params.slug))}/adjacent`,
);
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
  () => product.value?.description || "Товар из каталога Прохук.",
  () => product.value?.images[0]?.src ?? "/brand/lockup.webp",
);
// Переключение между товарами: стрелки ←/→ с клавиатуры в дополнение к
// ссылкам на странице. Не перехватываем клавиши, когда открыт диалог.
function goAdjacent(direction: "prev" | "next") {
  const target = adjacent.value?.[direction];
  if (target) void navigateTo(`/product/${target.slug}`);
}
function onKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey)
    return;
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea, select, [contenteditable]")) return;
  if (document.querySelector("dialog[open]")) return;
  if (event.key === "ArrowLeft") goAdjacent("prev");
  else if (event.key === "ArrowRight") goAdjacent("next");
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
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
        <ProductGallery
          :images="product.images"
          :restricted="product.imagesRestricted"
        />
        <div class="product-detail__info">
          <p class="eyebrow">
            {{ product.categoryName ?? "Каталог" }} / {{ product.sku }}
          </p>
          <h1>{{ product.name }}</h1>
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
          <div class="product-select">
            <template v-if="inList">
              <UiButton
                variant="secondary"
                @click="product && remove(product.id)"
                >Убрать из списка</UiButton
              >
              <NuxtLink to="/reserve" class="text-link"
                >К списку выбранных ↗</NuxtLink
              >
            </template>
            <UiButton
              v-else
              variant="secondary"
              @click="product && add(product.id)"
              >Добавить в список</UiButton
            >
            <p class="caption">
              Список используется для запроса на резерв в магазине; покупка —
              только в магазине.
            </p>
          </div>
          <ProductSpecifications :attributes="product.attributes" />
        </div>
      </div>
      <nav
        v-if="adjacent && (adjacent.prev || adjacent.next)"
        class="product-floating-nav"
        aria-label="Переключение между товарами"
      >
        <NuxtLink
          v-if="adjacent.prev"
          :to="`/product/${adjacent.prev.slug}`"
          class="product-floating-btn"
          :aria-label="`Предыдущий товар: ${adjacent.prev.name}`"
          :title="`Предыдущий товар: ${adjacent.prev.name}`"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </NuxtLink>
        <span v-else aria-hidden="true"></span>
        <NuxtLink
          v-if="adjacent.next"
          :to="`/product/${adjacent.next.slug}`"
          class="product-floating-btn"
          :aria-label="`Следующий товар: ${adjacent.next.name}`"
          :title="`Следующий товар: ${adjacent.next.name}`"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M9 5l7 7-7 7"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </NuxtLink>
      </nav>
      <nav
        v-if="adjacent && (adjacent.prev || adjacent.next)"
        class="product-adjacent"
        aria-label="Соседние товары категории"
      >
        <NuxtLink
          v-if="adjacent.prev"
          :to="`/product/${adjacent.prev.slug}`"
          class="product-adjacent__link"
        >
          <span class="caption" aria-hidden="true">← Предыдущий</span>
          <span class="product-adjacent__name">{{ adjacent.prev.name }}</span>
        </NuxtLink>
        <span v-else aria-hidden="true"></span>
        <NuxtLink
          v-if="adjacent.next"
          :to="`/product/${adjacent.next.slug}`"
          class="product-adjacent__link product-adjacent__link--next"
        >
          <span class="caption" aria-hidden="true">Следующий →</span>
          <span class="product-adjacent__name">{{ adjacent.next.name }}</span>
        </NuxtLink>
      </nav>
      <p
        v-if="adjacent && (adjacent.prev || adjacent.next)"
        class="caption product-adjacent__hint"
      >
        Между товарами можно переключаться стрелками ← → на клавиатуре.
      </p>
      <section v-if="product.description" class="product-description">
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

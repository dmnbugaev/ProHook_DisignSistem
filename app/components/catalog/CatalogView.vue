<script setup lang="ts">
const props = defineProps<{ categorySlug?: string; search?: boolean }>();
const route = useRoute();
const {
  data: meta,
  error: metaError,
  refresh: refreshMeta,
} = await useCatalogMeta();
const category = computed(() =>
  meta.value?.categories.find((item) => item.slug === props.categorySlug),
);
if (props.categorySlug && meta.value && !category.value)
  throw createError({
    statusCode: 404,
    statusMessage: "Not Found",
    message: "Категория не найдена",
  });
const { parsed, requestQuery, values, apply, reset, sort } = useCatalogQuery(
  () => props.categorySlug ?? "",
);
const { data, error, status, refresh } = await useProducts(requestQuery);
const filtersOpen = ref(false);
const { store, city, pickerOpen } = useStoreSelection();
const title = computed(() =>
  props.search
    ? parsed.value.q
      ? `Результаты для «${parsed.value.q}»`
      : "Поиск"
    : (category.value?.name ?? "Каталог"),
);
const description = computed(
  () =>
    category.value?.description ??
    "Товары Прохук: категории, цены и наличие по магазинам.",
);
usePageSeo(title, description);
const parents = computed(
  () => meta.value?.categories.filter((item) => !item.parentId) ?? [],
);
const children = computed(
  () =>
    meta.value?.categories.filter(
      (item) => item.parentId === category.value?.id,
    ) ?? [],
);
const parent = computed(() =>
  meta.value?.categories.find((item) => item.id === category.value?.parentId),
);
const breadcrumbs = computed(() => [
  { label: "Главная", to: "/" },
  ...(category.value || props.search
    ? [{ label: "Каталог", to: "/catalog" }]
    : []),
  ...(parent.value
    ? [{ label: parent.value.name, to: `/catalog/${parent.value.slug}` }]
    : []),
  { label: props.search ? "Поиск" : title.value },
]);
const activeCount = computed(
  () =>
    Number(!!values.value.minPrice || !!values.value.maxPrice) +
    Number(values.value.available),
);
async function applyFilters(value: Parameters<typeof apply>[0]) {
  await apply(value);
  filtersOpen.value = false;
}
async function resetFilters() {
  await reset();
  filtersOpen.value = false;
}
watch(
  () => route.fullPath,
  () => {
    if (import.meta.client) window.scrollTo({ top: 0, behavior: "instant" });
  },
);
</script>
<template>
  <UiContainer class="page-shell">
    <UiBreadcrumbs :items="breadcrumbs" />
    <div class="page-heading">
      <p class="eyebrow">Прохук / Каталог</p>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </div>
    <SearchForm v-if="search" :initial="parsed.q" />
    <CatalogCategories :categories="parents" :selected="category?.slug" />
    <nav
      v-if="children.length"
      class="subcategory-links"
      aria-label="Подкатегории"
    >
      <NuxtLink
        v-for="child in children"
        :key="child.id"
        :to="`/catalog/${child.slug}`"
        >{{ child.name }} ↗</NuxtLink
      >
    </nav>
    <div class="catalog-store">
      <span class="caption">{{
        store ? `${city?.name} · ${store.name}` : "Минимальная цена по городам"
      }}</span
      ><button type="button" class="text-link" @click="pickerOpen = true">
        {{ store ? "Изменить магазин" : "Выбрать магазин" }}
      </button>
    </div>
    <UiEmptyState v-if="metaError" title="Не удалось загрузить каталог"
      >Попробуйте обновить данные.<template #action
        ><UiButton @click="refreshMeta()">Повторить</UiButton></template
      ></UiEmptyState
    >
    <div v-else class="catalog-layout">
      <aside class="catalog-sidebar" aria-label="Фильтры">
        <h2>
          Фильтры <UiBadge v-if="activeCount">{{ activeCount }}</UiBadge>
        </h2>
        <CatalogFilters
          v-if="meta"
          :meta="meta"
          :values="values"
          @apply="applyFilters"
          @reset="resetFilters"
        />
      </aside>
      <div class="catalog-results" :aria-busy="status === 'pending'">
        <CatalogToolbar
          :total="data?.total ?? 0"
          :sort="parsed.sort"
          :active-count="activeCount"
          @sort="sort"
          @filters="filtersOpen = true"
        />
        <div v-if="status === 'pending'" class="catalog-loading">
          <UiSkeleton v-for="n in 3" :key="n" />
        </div>
        <UiEmptyState v-else-if="error" title="Не удалось загрузить товары"
          >Проверьте соединение и повторите попытку.<template #action
            ><UiButton @click="refresh()">Повторить</UiButton></template
          ></UiEmptyState
        >
        <template v-else-if="data?.items.length"
          ><ProductGrid :products="data.items" compact /><CatalogPagination
            :page="data.page"
            :page-count="data.pageCount"
        /></template>
        <UiEmptyState v-else title="Ничего не найдено"
          >Попробуйте изменить запрос или снять часть фильтров.<template #action
            ><UiButton
              v-if="activeCount"
              variant="secondary"
              @click="resetFilters"
              >Сбросить фильтры</UiButton
            ><NuxtLink v-else to="/catalog" class="button button--secondary"
              >Весь каталог</NuxtLink
            ></template
          ></UiEmptyState
        >
      </div>
    </div>
    <UiDialog v-model="filtersOpen" title="Фильтры" drawer
      ><CatalogFilters
        v-if="meta && filtersOpen"
        :meta="meta"
        :values="values"
        @apply="applyFilters"
        @reset="resetFilters"
    /></UiDialog>
  </UiContainer>
</template>

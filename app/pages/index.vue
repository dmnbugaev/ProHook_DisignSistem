<script setup lang="ts">
import { websiteSchema } from "~~/shared/seo/schema";

const { data: meta, error, refresh } = await useCatalogMeta();
const ageConfirmed = useAgeConfirmed();
const rootCategories = computed(
  () => meta.value?.categories.filter((item) => !item.parentId) ?? [],
);
const categories = computed(() => rootCategories.value.slice(0, 6));
// Статистика героя: суммы по корневым категориям (productCount считается при
// сборке снимка; в старых фикстурах поля нет — герой скрывает блок).
const productsTotal = computed(() => {
  const counts = rootCategories.value
    .map((item) => item.productCount)
    .filter((count): count is number => Number.isFinite(count));
  return counts.length ? counts.reduce((sum, count) => sum + count, 0) : 0;
});
// Секции каталога (категории, товары, бренды) скрываются до
// подтверждения 18+: SSR-HTML для краулеров и неподтвердивших
// посетителей не содержит витрины регулируемой продукции
// (инвариант tests/legal.spec.ts).
const catalogVisible = computed(() => ageConfirmed.value);
usePageSeo(
  "Сеть магазинов в Саратове и Москве",
  "ПроХук — сеть специализированных магазинов: адреса точек, режим работы, телефоны и справочный каталог ассортимента для лиц старше 18 лет.",
  undefined,
  { index: true },
);
const siteUrl = useRuntimeConfig().public.siteUrl || "https://прохук.рф";
useHead({
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify(websiteSchema(siteUrl)),
    },
  ],
  link: [
    {
      rel: "preload",
      as: "image",
      href: "/brand/mark-large.webp",
      fetchpriority: "high",
    },
  ],
});
</script>
<template>
  <div>
    <HeroSection
      :stores-count="meta?.stores.length"
      :products-total="productsTotal"
      :cities-count="meta?.cities.length"
    /><CategoriesSection
      v-if="catalogVisible && meta"
      :categories="categories"
    /><UiContainer v-else-if="catalogVisible && error" class="section"
      ><UiEmptyState title="Не удалось загрузить категории"
        >Попробуйте ещё раз.<template #action
          ><UiButton @click="refresh()">Повторить</UiButton></template
        ></UiEmptyState
      ></UiContainer
    ><PopularProductsSection v-if="catalogVisible" /><PromosSection
      v-if="catalogVisible"
    /><BrandsSection
      v-if="catalogVisible && meta"
      :categories="categories"
    /><AboutSection /><StoresSection /><ContactsSection />
  </div>
</template>

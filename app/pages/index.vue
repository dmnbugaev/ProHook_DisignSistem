<script setup lang="ts">
import { websiteSchema } from "~~/shared/seo/schema";

const { data: meta, error, refresh } = await useCatalogMeta();
const ageConfirmed = useAgeConfirmed();
const categories = computed(
  () =>
    meta.value?.categories.filter((item) => !item.parentId).slice(0, 6) ?? [],
);
// Секции каталога (категории, товары, бренды) скрываются до
// подтверждения 18+: SSR-HTML для краулеров и неподтвердивших
// посетителей не содержит витрины регулируемой продукции
// (инвариант tests/legal.spec.ts).
const catalogVisible = computed(() => ageConfirmed.value);
usePageSeo(
  "Сеть магазинов в Саратове и Москве",
  "Прохук — сеть специализированных магазинов: адреса точек, режим работы, телефоны и справочный каталог ассортимента для лиц старше 18 лет.",
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
    <HeroSection /><CategoriesSection
      v-if="catalogVisible && meta"
      :categories="categories"
    /><UiContainer v-else-if="catalogVisible && error" class="section"
      ><UiEmptyState title="Не удалось загрузить категории"
        >Попробуйте ещё раз.<template #action
          ><UiButton @click="refresh()">Повторить</UiButton></template
        ></UiEmptyState
      ></UiContainer
    ><PopularProductsSection v-if="catalogVisible" /><HeatingNoveltySection
      v-if="catalogVisible"
    /><BrandsSection
      v-if="catalogVisible && meta"
      :categories="categories"
    /><AboutSection /><StoresSection /><ContactsSection />
  </div>
</template>

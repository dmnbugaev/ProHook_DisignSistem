<script setup lang="ts">
const { data } = await useCatalogMeta();
const categories = computed(
  () =>
    data.value?.categories.filter((item) => !item.parentId).slice(0, 8) ?? [],
);
</script>
<template>
  <UiContainer as="footer" class="app-footer">
    <div class="footer-grid">
      <div class="footer-brand">
        <img
          src="/brand/lockup.webp"
          width="120"
          height="120"
          alt="Прохук"
          loading="lazy"
        />
        <p class="caption">Простая форма.<br />Внимание к деталям.</p>
      </div>
      <nav aria-label="Навигация в подвале">
        <h2>Проект</h2>
        <NuxtLink to="/about">О проекте</NuxtLink
        ><NuxtLink to="/stores">Магазины</NuxtLink
        ><NuxtLink to="/contacts">Контакты</NuxtLink>
      </nav>
      <nav aria-label="Каталог в подвале">
        <h2>Каталог</h2>
        <NuxtLink
          v-for="category in categories"
          :key="category.id"
          :to="`/catalog/${category.slug}`"
          >{{ category.name }}</NuxtLink
        ><NuxtLink to="/catalog">Все категории ↗</NuxtLink
        ><NuxtLink to="/search">Поиск</NuxtLink>
      </nav>
      <div class="footer-note">
        <h2>Каталог Прохук</h2>
        <p class="caption">
          Товары и наличие обновляются из МойСклад. Выберите магазин для
          проверки наличия.
        </p>
        <NuxtLink to="/design-system" class="text-link"
          >Дизайн-система ↗</NuxtLink
        >
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 Прохук</span><span>18+</span
      ><NuxtLink to="/information">Информация о проекте</NuxtLink>
    </div>
  </UiContainer>
</template>

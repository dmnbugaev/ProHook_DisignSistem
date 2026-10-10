<script setup lang="ts">
import { prohookContacts } from "~~/shared/content/prohook";
import { sellerRequisites } from "~~/shared/content/legal";

const { data } = await useCatalogMeta();
const categories = computed(
  () =>
    data.value?.categories.filter((item) => !item.parentId).slice(0, 8) ?? [],
);
const { openSettings: openConsentSettings } = useConsentSettings();
function footerPhoneClick() {
  trackEvent("store_phone_click", { source: "footer" });
}
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
        <p class="caption">Прохук · Сеть магазинов</p>
      </div>
      <nav aria-label="Навигация в подвале">
        <h2>Прохук</h2>
        <NuxtLink to="/about">О нас</NuxtLink
        ><NuxtLink to="/stores">Магазины</NuxtLink
        ><NuxtLink to="/contacts">Контакты</NuxtLink
        ><NuxtLink to="/partners">Стать партнёром</NuxtLink>
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
        <h2>На связи</h2>
        <p class="caption">
          <a :href="prohookContacts.phoneHref" @click="footerPhoneClick">{{
            prohookContacts.phone
          }}</a
          ><br />
          {{ prohookContacts.hours }}<br />
          Информация на сайте предназначена для лиц старше 18 лет.
        </p>
        <nav class="footer-socials" aria-label="Социальные сети Прохук">
          <a
            :href="prohookContacts.vk"
            class="text-link"
            target="_blank"
            rel="noopener noreferrer"
            >ВКонтакте ↗</a
          >
          <a
            :href="prohookContacts.telegram"
            class="text-link"
            target="_blank"
            rel="noopener noreferrer"
            >Telegram ↗</a
          >
          <a
            :href="prohookContacts.instagram"
            class="text-link"
            target="_blank"
            rel="noopener noreferrer"
            >Instagram ↗</a
          >
        </nav>
        <p class="caption footer-disclaimer">
          Instagram принадлежит компании Meta, признанной экстремистской
          организацией, деятельность которой запрещена на территории РФ.
        </p>
      </div>
    </div>
    <div class="footer-bottom">
      <p class="footer-bottom__legal">
        <span>© 2026 Прохук · {{ sellerRequisites.shortName }}</span>
        <span>ИНН {{ sellerRequisites.inn }}</span>
        <span>ОГРНИП {{ sellerRequisites.ogrnip }}</span>
      </p>
      <nav aria-label="Юридическая информация">
        <span
          class="footer-bottom__age"
          aria-label="Только для совершеннолетних"
          >18+</span
        ><NuxtLink to="/information">Информация о сайте</NuxtLink
        ><NuxtLink to="/privacy"
          >Политика обработки персональных данных</NuxtLink
        ><NuxtLink to="/personal-data"
          >Согласие на обработку персональных данных</NuxtLink
        ><button type="button" @click="openConsentSettings()">
          Файлы cookie
        </button>
      </nav>
    </div>
  </UiContainer>
</template>

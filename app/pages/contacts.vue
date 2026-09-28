<script setup lang="ts">
import { prohookContacts } from "~~/shared/content/prohook";

usePageSeo(
  "Контакты",
  "Контакты Прохук: телефон, электронная почта, ВКонтакте, Telegram и Instagram.",
);
</script>
<template>
  <UiContainer class="page-shell"
    ><UiBreadcrumbs
      :items="[{ label: 'Главная', to: '/' }, { label: 'Контакты' }]"
    />
    <div class="page-heading">
      <p class="eyebrow">Прохук / Контакты</p>
      <h1>На связи<br />с вами.</h1>
      <p>
        Вопросы о магазинах и ассортименте можно направить по телефону, почте
        или через официальное сообщество.
      </p>
    </div>
    <div class="contact-grid">
      <section>
        <h2>Связаться с нами</h2>
        <dl class="specifications">
          <div>
            <dt>Телефон</dt>
            <dd>
              <a :href="prohookContacts.phoneHref">{{
                prohookContacts.phone
              }}</a>
            </dd>
          </div>
          <div>
            <dt>Электронная почта</dt>
            <dd>
              <a :href="`mailto:${prohookContacts.email}`">{{
                prohookContacts.email
              }}</a>
            </dd>
          </div>
          <div>
            <dt>Социальные сети</dt>
            <dd>
              <a
                :href="prohookContacts.vk"
                target="_blank"
                rel="noopener noreferrer"
                >ВКонтакте ↗</a
              >
              ·
              <a
                :href="prohookContacts.telegram"
                target="_blank"
                rel="noopener noreferrer"
                >Telegram ↗</a
              >
              ·
              <a
                :href="prohookContacts.instagram"
                target="_blank"
                rel="noopener noreferrer"
                >Instagram ↗</a
              >
            </dd>
          </div>
          <div>
            <dt>Режим работы</dt>
            <dd>{{ prohookContacts.hours }}</dd>
          </div>
        </dl>
      </section>
      <section>
        <h2>Наши пространства</h2>
        <p>
          Выберите город и точку, чтобы посмотреть её адрес, цену и наличие
          товаров. Перед визитом можно уточнить режим работы по телефону.
        </p>
        <NuxtLink to="/stores" class="button button--secondary"
          >Смотреть магазины ↗</NuxtLink
        >
      </section>
    </div></UiContainer
  >
</template>

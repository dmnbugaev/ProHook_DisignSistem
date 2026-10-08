<script setup lang="ts">
import { prohookContacts } from "~~/shared/content/prohook";

usePageSeo(
  "Контакты",
  "Контакты Прохук: телефон, электронная почта, ВКонтакте, Telegram, Instagram и карта всех магазинов сети.",
);
const socials = [
  { label: "ВКонтакте", href: prohookContacts.vk, network: "vk" as const },
  {
    label: "Telegram",
    href: prohookContacts.telegram,
    network: "telegram" as const,
  },
  {
    label: "Instagram",
    href: prohookContacts.instagram,
    network: "instagram" as const,
  },
];
</script>
<template>
  <UiContainer class="page-shell"
    ><UiBreadcrumbs
      :items="[{ label: 'Главная', to: '/' }, { label: 'Контакты' }]" />
    <div class="page-heading">
      <p class="eyebrow">Прохук / Контакты</p>
      <h1>На связи с вами.</h1>
      <p>
        Вопросы о магазинах и ассортименте можно направить по телефону, почте
        или через официальное сообщество.
      </p>
    </div>
    <div class="contact-grid">
      <section aria-labelledby="contacts-communication">
        <h2 id="contacts-communication">Связаться с нами</h2>
        <dl class="specifications specifications--contacts">
          <div>
            <dt>Телефон</dt>
            <dd>
              <a :href="prohookContacts.phoneHref">{{
                prohookContacts.phone
              }}</a>
            </dd>
          </div>
          <div>
            <dt>Почта</dt>
            <dd>
              <a :href="`mailto:${prohookContacts.email}`">{{
                prohookContacts.email
              }}</a>
            </dd>
          </div>
          <div>
            <dt>Режим работы</dt>
            <dd>{{ prohookContacts.hours }}</dd>
          </div>
          <div>
            <dt>Соцсети</dt>
            <dd>
              <ul class="contact-links">
                <li v-for="social in socials" :key="social.label">
                  <a
                    :href="social.href"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span class="contact-links__icon" aria-hidden="true"
                      ><SocialIcon :network="social.network" :size="26"
                    /></span>
                    <span>{{ social.label }}</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                </li>
              </ul>
            </dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="contacts-stores" class="contact-stores">
        <h2 id="contacts-stores">Сеть магазинов</h2>
        <p>
          Выберите город и точку, чтобы посмотреть её адрес, цену и наличие
          товаров. Перед визитом можно уточнить режим работы по телефону.
        </p>
        <NuxtLink to="/stores" class="button button--secondary"
          >Смотреть магазины <span aria-hidden="true">↗</span></NuxtLink
        >
      </section>
    </div>
    <StoresMapSection
  /></UiContainer>
</template>

<script setup lang="ts">
import { prohookContacts } from "~~/shared/content/prohook";
import { organizationSchema } from "~~/shared/seo/schema";
import {
  METRIKA_COUNTER_ID,
  resolveMetrika,
} from "~~/shared/analytics/metrika";

// Organization — на всех страницах (проверяемые сведения о продавце).
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl || "https://прохук.рф";
useHead({
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify(organizationSchema(prohookContacts, siteUrl)),
    },
  ],
});
// Пиксель для посетителей без JavaScript (официальный код установки
// Метрики). Отрисовывается только когда счётчик активен И посетитель уже
// дал согласие на аналитические cookie (см. shared/analytics/consent.ts):
// выразить согласие без JavaScript невозможно, поэтому для таких
// посетителей аналитика не собирается вовсе.
const metrikaActive = resolveMetrika({
  setting: config.public.metrikaEnabled,
  prod: process.env.NODE_ENV === "production",
  hostname: useRequestURL().hostname,
});
const { analyticsAllowed } = useConsentSettings();
if (metrikaActive && analyticsAllowed.value) {
  useHead({
    noscript: [
      {
        innerHTML: `<div><img src="https://mc.yandex.ru/watch/${METRIKA_COUNTER_ID}" style="position:absolute; left:-9999px;" alt="" /></div>`,
      },
    ],
  });
}
</script>

<template>
  <NuxtLayout><NuxtPage /></NuxtLayout>
</template>

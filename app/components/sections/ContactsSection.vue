<script setup lang="ts">
import { prohookContacts } from "~~/shared/content/prohook";
</script>
<template>
  <UiContainer as="section" class="section"
    ><div class="contact-section">
      <h2>Остаёмся на связи.</h2>
      <div>
        <p>
          Контакты сети и каналы Прохук — в одном месте. Откройте страницу
          контактов или перейдите в удобную социальную сеть.
        </p>
        <div class="contact-section__links">
          <NuxtLink to="/contacts" class="text-link">Контакты ↗</NuxtLink>
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
        </div>
      </div>
    </div></UiContainer
  >
</template>

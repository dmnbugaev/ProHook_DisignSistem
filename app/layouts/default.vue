<script setup lang="ts">
// Memory only: a fresh document load requires a new confirmation.
const ageConfirmed = useState("age-confirmed", () => false);
</script>

<template>
  <div>
    <div id="top" :inert="!ageConfirmed">
      <a class="skip-link" href="#main">Перейти к содержимому</a>
      <SiteHeader />
      <main id="main"><slot /></main>
      <SiteFooter />
    </div>
    <AgeGate v-model="ageConfirmed" />
    <noscript
      >Для подтверждения возраста 18+ и доступа к сайту включите
      JavaScript.</noscript
    >
  </div>
</template>

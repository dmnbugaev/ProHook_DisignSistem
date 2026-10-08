<script setup lang="ts">
import type { LoyaltyResponse } from "~~/shared/types/account";
import {
  formatDateOfBirth,
  formatPhone,
  fullName,
  pluralBonus,
} from "~~/shared/utils/account";

usePageSeo("Личный кабинет", "Бонусы Прохук и личные данные.");
const { user } = useSessionUser();

// Бонусы грузятся явным запросом при появлении пользователя сессии:
// без гонки enabled-опции useAsyncData с обновлением session-user.
const loyalty = ref<LoyaltyResponse | null>(null);
const loyaltyPending = ref(true);
const loyaltyFailed = ref(false);
const loyaltyUnauthorized = ref(false);
const loyaltyMessage = ref(
  "Не удалось загрузить информацию о бонусах. Попробуйте позже.",
);
async function loadLoyalty() {
  if (!user.value) return;
  loyaltyPending.value = true;
  loyaltyFailed.value = false;
  try {
    loyalty.value = await $fetch<LoyaltyResponse>("/api/account/loyalty", {
      retry: 0,
    });
    // Сообщение статуса (например, «карта не привязана») показывается как есть.
    if (loyalty.value?.message) loyaltyMessage.value = loyalty.value.message;
  } catch (error) {
    const response = error as {
      statusCode?: number;
      data?: { data?: { message?: string } };
    };
    loyaltyUnauthorized.value = response.statusCode === 401;
    loyaltyMessage.value = response.data?.data?.message ?? loyaltyMessage.value;
    loyaltyFailed.value = true;
  } finally {
    loyaltyPending.value = false;
  }
}
watch(
  user,
  (value) => {
    if (value) void loadLoyalty();
  },
  { immediate: true },
);

const loggingOut = ref(false);
async function logout() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  try {
    await $fetch("/api/auth/logout", { method: "POST", retry: 0 });
    setSessionUser(null);
    await navigateTo("/login");
  } finally {
    loggingOut.value = false;
  }
}
</script>

<template>
  <UiContainer class="page-shell account-page">
    <UiBreadcrumbs
      :items="[{ label: 'Главная', to: '/' }, { label: 'Личный кабинет' }]"
    />
    <section v-if="!user" class="account-gate" aria-labelledby="account-title">
      <h1 id="account-title">Личный кабинет</h1>
      <p>Войдите, чтобы получить доступ к личному кабинету.</p>
      <div class="account-gate__actions">
        <NuxtLink to="/login" class="button button--large">Войти</NuxtLink>
        <NuxtLink to="/register" class="button button--secondary button--large"
          >Зарегистрироваться</NuxtLink
        >
      </div>
    </section>
    <template v-else>
      <header class="account-header">
        <h1>Личный кабинет</h1>
        <p class="account-greeting">
          Здравствуйте, <strong>{{ fullName(user) }}</strong
          >!
        </p>
        <p class="caption">
          Телефон: {{ formatPhone(user.phone) }} · Дата рождения:
          {{ formatDateOfBirth(user.dateOfBirth) }}
        </p>
        <p v-if="!user.isAdult" class="account-note" role="note">
          Изображения товаров доступны только совершеннолетним пользователям.
        </p>
      </header>

      <section class="account-block" aria-labelledby="bonuses-title">
        <h2 id="bonuses-title">Мои бонусы</h2>
        <p v-if="loyaltyPending" class="account-bonus account-bonus--loading">
          Загружаем бонусы…
        </p>
        <template v-else-if="loyaltyFailed">
          <p v-if="loyaltyUnauthorized" class="account-bonus--error">
            Сессия истекла. Войдите заново, чтобы увидеть бонусы.
          </p>
          <template v-else>
            <p class="account-bonus--error">{{ loyaltyMessage }}</p>
            <UiButton variant="secondary" @click="loadLoyalty()"
              >Повторить</UiButton
            >
          </template>
        </template>
        <template v-else-if="loyalty?.status === 'ok'">
          <p class="account-bonus">
            {{ loyalty.balance }}
            <span>{{ pluralBonus(loyalty.balance ?? 0) }}</span>
          </p>
          <p class="caption">
            <template v-if="loyalty.loyaltyLevel"
              >Уровень: {{ loyalty.loyaltyLevel }}. </template
            ><template v-if="loyalty.discount"
              >Скидка по карте: {{ loyalty.discount }}. </template
            >Бонусами можно оплатить до 100% покупки на кассе магазинов Прохук.
          </p>
        </template>
        <p v-else class="account-bonus--empty">{{ loyaltyMessage }}</p>
      </section>

      <section class="account-block" aria-labelledby="profile-title">
        <h2 id="profile-title">Личные данные</h2>
        <dl class="account-profile">
          <div>
            <dt>Фамилия</dt>
            <dd>{{ user.lastName }}</dd>
          </div>
          <div>
            <dt>Имя</dt>
            <dd>{{ user.firstName }}</dd>
          </div>
          <div>
            <dt>Отчество</dt>
            <dd>{{ user.middleName }}</dd>
          </div>
          <div>
            <dt>Дата рождения</dt>
            <dd>{{ formatDateOfBirth(user.dateOfBirth) }}</dd>
          </div>
          <div>
            <dt>Телефон</dt>
            <dd>{{ formatPhone(user.phone) }}</dd>
          </div>
        </dl>
      </section>

      <div class="account-actions">
        <UiButton
          variant="secondary"
          size="large"
          :loading="loggingOut"
          @click="logout"
          >Выйти</UiButton
        >
      </div>
    </template>
  </UiContainer>
</template>

<style scoped>
.account-page {
  padding-bottom: var(--section-space);
}
.account-gate,
.account-header {
  margin-top: 32px;
}
.account-gate h1,
.account-header h1 {
  font-size: clamp(36px, 4vw, 56px);
}
.account-gate p {
  margin: 16px 0 28px;
  max-width: 40ch;
}
.account-gate__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.account-greeting {
  margin: 16px 0 8px;
  font-size: 20px;
}
.account-note {
  margin-top: 12px;
  padding: 12px 16px;
  border: 1px solid var(--separator);
  border-radius: var(--radius-control);
  color: var(--text-secondary);
  max-width: 60ch;
}
.account-block {
  margin-top: 40px;
  border: 1px solid var(--separator);
  border-radius: var(--radius-card);
  padding: clamp(20px, 3vw, 40px);
  background: var(--surface-subtle);
}
.account-block h2 {
  font-size: 20px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  margin-bottom: 20px;
}
.account-bonus {
  font-size: clamp(40px, 5vw, 64px);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
}
.account-bonus span {
  font-size: 0.5em;
  font-weight: 700;
  color: var(--text-secondary);
}
.account-bonus--loading {
  color: var(--text-secondary);
  font-size: 20px;
  font-weight: 400;
}
.account-bonus--error,
.account-bonus--empty {
  color: var(--text-secondary);
  max-width: 56ch;
}
.account-block .button {
  margin-top: 16px;
}
.account-profile {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 20px 32px;
  margin: 0;
}
.account-profile dt {
  font-size: var(--font-caption);
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.account-profile dd {
  margin: 0;
  font-size: 17px;
}
.account-actions {
  margin-top: 32px;
}
</style>

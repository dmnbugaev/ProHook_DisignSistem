<script setup lang="ts">
import type { LoyaltyResponse } from "~~/shared/types/account";
import {
  formatDateOfBirth,
  formatPhone,
  fullName,
  pluralBonus,
} from "~~/shared/utils/account";

usePageSeo("Личный кабинет", "Бонусы Прохук и личные данные.");
const { user, staffInbox } = useSessionUser();

// Инбокс сотрудников: свежие резервы и партнёрские заявки. Резервный канал
// оповещения на случай недоступности Telegram-уведомлений с хостинга.
interface InboxReservation {
  publicId: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  customerName: string;
  phone: string;
  storeName: string;
  storeAddress: string;
  comment: string;
  items: Array<{ name: string; quantity: number }>;
  telegramDelivered: boolean;
}
interface InboxPartnership {
  publicId: string;
  createdAt: string;
  name: string;
  phone: string;
  city: string;
  company: string;
  offer: string;
  telegramDelivered: boolean;
}
interface InboxResponse {
  reservations: InboxReservation[];
  partnerships: InboxPartnership[];
}
const inbox = ref<InboxResponse | null>(null);
const inboxPending = ref(false);
const inboxFailed = ref(false);
async function loadInbox() {
  if (!staffInbox.value || inboxPending.value) return;
  inboxPending.value = true;
  inboxFailed.value = false;
  try {
    inbox.value = await $fetch<InboxResponse>("/api/staff/inbox", {
      retry: 0,
    });
  } catch {
    inboxFailed.value = true;
  } finally {
    inboxPending.value = false;
  }
}
watch(
  () => [user.value?.id, staffInbox.value] as const,
  ([, allowed]) => {
    if (allowed) void loadInbox();
  },
  { immediate: true },
);
function inboxTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

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

      <section
        v-if="staffInbox"
        class="account-block"
        aria-labelledby="inbox-title"
      >
        <div class="account-inbox__header">
          <h2 id="inbox-title">Заявки сети</h2>
          <button
            type="button"
            class="text-link"
            :disabled="inboxPending"
            @click="loadInbox()"
          >
            {{ inboxPending ? "Обновляем…" : "Обновить" }}
          </button>
        </div>
        <p class="caption account-inbox__note">
          Резервный канал оповещения: свежие запросы на резерв и заявки на
          партнёрство, сохранённые сервером (включая недоставленные в Telegram).
          Данные видны только сотрудникам сети.
        </p>
        <p v-if="inboxFailed" class="account-bonus--error">
          Не удалось загрузить заявки. Попробуйте обновить позже.
        </p>
        <p
          v-else-if="
            !inboxPending &&
            !inbox?.reservations.length &&
            !inbox?.partnerships.length
          "
          class="caption"
        >
          Новых заявок нет.
        </p>
        <template v-else>
          <h3 class="account-inbox__heading">Запросы на резерв</h3>
          <ul v-if="inbox?.reservations.length" class="account-inbox">
            <li v-for="item in inbox.reservations" :key="item.publicId">
              <p class="account-inbox__title">
                <strong>{{ item.publicId }}</strong>
                · {{ inboxTime(item.createdAt) }}
                <span class="caption">{{
                  item.telegramDelivered
                    ? "Telegram: доставлено"
                    : "Telegram: не доставлено"
                }}</span>
              </p>
              <p class="caption">
                {{ item.customerName }} · {{ formatPhone(item.phone) }} ·
                {{ item.storeName
                }}<template v-if="item.storeAddress">
                  · {{ item.storeAddress }}</template
                >
              </p>
              <p class="caption">
                {{
                  item.items
                    .map((entry) => `${entry.name} ×${entry.quantity}`)
                    .join("; ")
                }}
              </p>
              <p v-if="item.comment" class="caption">
                Комментарий: {{ item.comment }}
              </p>
            </li>
          </ul>
          <p v-else class="caption">Запросов нет.</p>
          <h3 class="account-inbox__heading">Заявки на партнёрство</h3>
          <ul v-if="inbox?.partnerships.length" class="account-inbox">
            <li v-for="item in inbox.partnerships" :key="item.publicId">
              <p class="account-inbox__title">
                <strong>{{ item.publicId }}</strong>
                · {{ inboxTime(item.createdAt) }}
                <span class="caption">{{
                  item.telegramDelivered
                    ? "Telegram: доставлено"
                    : "Telegram: не доставлено"
                }}</span>
              </p>
              <p class="caption">
                {{ item.name }} · {{ formatPhone(item.phone) }} ·
                {{ item.city }} · {{ item.company }}
              </p>
              <p class="caption">{{ item.offer }}</p>
            </li>
          </ul>
          <p v-else class="caption">Заявок нет.</p>
        </template>
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
.account-inbox__note {
  margin-bottom: 20px;
}
.account-inbox__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
}
.account-inbox__header h2 {
  margin-bottom: 0;
}
.account-inbox__heading {
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  margin-top: 24px;
}
.account-inbox {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  gap: 16px;
}
.account-inbox li {
  border: 1px solid var(--separator);
  border-radius: var(--radius-control);
  padding: 12px 16px;
  display: grid;
  gap: 4px;
}
.account-inbox__title {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
}
.account-actions {
  margin-top: 32px;
}
</style>

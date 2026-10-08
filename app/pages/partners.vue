<script setup lang="ts">
import { validatePartnership } from "~~/shared/utils/partnership";
import { prohookContacts } from "~~/shared/content/prohook";

usePageSeo(
  "Стать партнёром",
  "Оставьте заявку на сотрудничество с Прохук: расскажите о вашей компании, и мы свяжемся с вами.",
);
const form = reactive({
  name: "",
  phone: "",
  city: "",
  company: "",
  offer: "",
  consent: false,
  consentTelegram: false,
  website: "",
});
const errors = ref<Record<string, string>>({});
const pending = ref(false);
const sent = ref(false);
const failure = ref("");
const formElement = ref<HTMLFormElement>();
const successElement = ref<HTMLElement>();

async function submit() {
  if (pending.value) return;
  failure.value = "";
  const validation = validatePartnership(form);
  errors.value = validation.errors;
  if (!validation.valid) {
    await nextTick();
    formElement.value
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
    return;
  }
  pending.value = true;
  try {
    await $fetch("/api/partnership", { method: "POST", body: form, retry: 0 });
    sent.value = true;
    Object.assign(form, {
      name: "",
      phone: "",
      city: "",
      company: "",
      offer: "",
      consent: false,
      consentTelegram: false,
      website: "",
    });
    await nextTick();
    successElement.value?.focus();
  } catch (error) {
    const response = error as {
      statusCode?: number;
      data?: { data?: { errors?: Record<string, string> } };
    };
    if (response.statusCode === 422 && response.data?.data?.errors) {
      errors.value = response.data.data.errors;
    }
    failure.value =
      response.statusCode === 429
        ? "Слишком много попыток. Попробуйте через 15 минут или свяжитесь с нами по телефону."
        : "Не удалось подтвердить отправку. Ваши данные остались в форме. Попробуйте позже или свяжитесь с нами по телефону.";
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <UiContainer class="page-shell partner-page">
    <UiBreadcrumbs
      :items="[{ label: 'Главная', to: '/' }, { label: 'Стать партнёром' }]"
    />
    <div class="partner-layout">
      <section class="partner-content" aria-labelledby="partner-title">
        <h1 id="partner-title">Стать<br />партнёром.</h1>
        <p class="partner-intro">
          Оставьте ваши контакты — обсудим сотрудничество с вашей компанией.
        </p>
        <div
          v-if="sent"
          ref="successElement"
          class="partner-success"
          tabindex="-1"
          role="status"
        >
          <span class="partner-check" aria-hidden="true">✓</span>
          <h2>Заявка отправлена</h2>
          <p>
            Спасибо за интерес к Прохук. Мы свяжемся с вами по указанному
            телефону.
          </p>
          <NuxtLink to="/" class="button button--secondary"
            >На главную</NuxtLink
          >
        </div>
        <form
          v-else
          ref="formElement"
          class="partner-form"
          novalidate
          :aria-busy="pending"
          @submit.prevent="submit"
        >
          <p class="caption">Все поля обязательны для заполнения.</p>
          <fieldset :disabled="pending">
            <legend class="sr-only">Контакты и компания</legend>
            <UiField
              v-model="form.name"
              label="ФИО"
              name="name"
              autocomplete="name"
              placeholder="Иванов Иван Иванович"
              required
              maxlength="150"
              :error="errors.name"
            />
            <UiField
              v-model="form.phone"
              label="Ваш телефон"
              name="phone"
              type="tel"
              autocomplete="tel"
              placeholder="+7 (999) 123-45-67"
              required
              maxlength="32"
              :error="errors.phone"
            />
            <UiField
              v-model="form.city"
              label="Город / регион"
              name="city"
              autocomplete="address-level2"
              placeholder="Москва"
              required
              maxlength="150"
              :error="errors.city"
            />
            <UiField
              v-model="form.company"
              label="Название компании"
              name="company"
              autocomplete="organization"
              placeholder="Ваша компания"
              required
              maxlength="150"
              :error="errors.company"
            />
            <UiField
              v-model="form.offer"
              label="Партнёрское предложение"
              name="offer"
              multiline
              placeholder="Опишите формат сотрудничества: например, оптовые закупки, совместные акции, поставка продукции в вашу сеть…"
              required
              maxlength="500"
              :error="errors.offer"
            />
            <div class="partner-trap" aria-hidden="true" inert>
              <label
                >Ваш сайт<input
                  v-model="form.website"
                  name="website"
                  tabindex="-1"
                  autocomplete="off"
              /></label>
            </div>
            <div>
              <UiCheckbox
                v-model="form.consent"
                name="consent"
                required
                label="Согласен(на) на обработку моих персональных данных (ФИО, телефон, город/регион, компания, текст предложения) в целях рассмотрения заявки о сотрудничестве."
                :aria-invalid="!!errors.consent"
                :aria-describedby="errors.consent ? 'consent-error' : undefined"
              />
              <p class="field__help partner-form__consent-links">
                Текст согласия —
                <NuxtLink to="/personal-data" target="_blank"
                  >Согласие на обработку персональных данных</NuxtLink
                >, подробности обработки —
                <NuxtLink to="/privacy" target="_blank"
                  >Политика обработки персональных данных</NuxtLink
                >.
              </p>
              <p
                v-if="errors.consent"
                id="consent-error"
                class="field__help field__help--error"
              >
                {{ errors.consent }}
              </p>
            </div>
            <div>
              <UiCheckbox
                v-model="form.consentTelegram"
                name="consentTelegram"
                required
                label="Согласен(на) на передачу заявки через сервис Telegram (api.telegram.org), включая трансграничную передачу указанных персональных данных."
                :aria-invalid="!!errors.consentTelegram"
                :aria-describedby="
                  errors.consentTelegram ? 'consent-telegram-error' : undefined
                "
              />
              <p
                v-if="errors.consentTelegram"
                id="consent-telegram-error"
                class="field__help field__help--error"
              >
                {{ errors.consentTelegram }}
              </p>
            </div>
          </fieldset>
          <p v-if="failure" role="alert" class="partner-error">
            {{ failure }}
            <a :href="prohookContacts.phoneHref">{{ prohookContacts.phone }}</a>
          </p>
          <UiButton type="submit" size="large" :loading="pending">{{
            pending ? "Отправляем…" : "Отправить заявку"
          }}</UiButton>
        </form>
      </section>
      <aside class="partner-visual" aria-label="Партнёрство с Прохук">
        <span class="partner-wordmark">ПРОХУК</span>
        <img src="/brand/mark-large.webp" alt="" width="600" height="600" />
        <div class="partner-visual__caption">
          <p>Давайте<br />работать вместе.</p>
          <span>Открыты к сотрудничеству<br />с вашим бизнесом</span>
        </div>
      </aside>
    </div>
  </UiContainer>
</template>

<style scoped>
.partner-page {
  padding-bottom: var(--section-space);
}
.partner-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-top: 32px;
  background: var(--ink);
  color: var(--background);
}
.partner-content {
  padding: clamp(24px, 4vw, 64px);
}
.partner-content h1 {
  font-size: clamp(40px, 4.6vw, 68px);
}
.partner-intro {
  margin: 24px 0 32px;
  color: #d9d9d9;
  max-width: 34ch;
}
.partner-form {
  display: grid;
  gap: 24px;
}
.partner-form > .caption {
  color: #b8b8b8;
}
.partner-form fieldset {
  display: grid;
  gap: 24px;
  min-width: 0;
  border: 0;
  margin: 0;
}
.partner-form :deep(.field__label) {
  color: white;
}
.partner-form :deep(input:not([type="checkbox"])),
.partner-form :deep(textarea) {
  background: black;
  color: white;
  border: 1px solid white;
  border-radius: var(--radius-control);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}
.partner-form :deep(input::placeholder),
.partner-form :deep(textarea::placeholder) {
  color: #929292;
}
.partner-form :deep(.choice) {
  align-items: flex-start;
  color: #d9d9d9;
  font-size: 13px;
  line-height: 1.6;
}
.partner-form :deep(.choice input) {
  flex-shrink: 0;
  margin-top: 3px;
}
.partner-form :deep(.field__help--error),
.partner-error {
  color: #ffb4a8;
}
.partner-form__consent-links {
  margin-top: 12px;
  color: #929292;
}
.partner-form__consent-links a {
  color: white;
  text-decoration: underline;
}
.partner-form :deep([aria-invalid="true"]) {
  border-color: #ffb4a8;
}
/* The global focus ring (white halo + far offset) reads as noise on black. */
.partner-page :focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  box-shadow: none;
}
.partner-form :deep(input:not([type="checkbox"]):focus-visible),
.partner-form :deep(textarea:focus-visible) {
  outline: none;
  border-color: var(--accent);
  box-shadow:
    0 0 0 4px rgba(255, 254, 0, 0.28),
    0 0 22px rgba(255, 254, 0, 0.14);
}
.partner-form :deep([aria-invalid="true"]:focus-visible) {
  border-color: #ffb4a8;
  box-shadow:
    0 0 0 4px rgba(255, 180, 168, 0.28),
    0 0 22px rgba(255, 180, 168, 0.14);
}
.partner-form > .button {
  color: var(--ink);
  justify-self: start;
}
.partner-trap {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.partner-visual {
  background: var(--accent);
  color: var(--ink);
  padding: 48px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
}
.partner-wordmark {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.06em;
}
.partner-visual img {
  width: 100%;
  margin: 40px 0;
  mix-blend-mode: multiply;
}
.partner-visual__caption p {
  font-size: clamp(32px, 3vw, 48px);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.04em;
  margin-bottom: 24px;
}
.partner-visual__caption span {
  font-size: 14px;
}
.partner-success {
  display: grid;
  gap: 24px;
  padding: 32px 0;
}
.partner-success .button {
  background: white;
  color: black;
  justify-self: start;
}
.partner-check {
  color: var(--accent);
  font-size: 48px;
}
@media (max-width: 899px) {
  .partner-layout {
    grid-template-columns: 1fr;
    margin-top: 24px;
  }
  .partner-visual {
    padding: 32px;
  }
  .partner-visual img {
    width: 180px;
    margin: 24px auto;
  }
  .partner-form > .button {
    width: 100%;
  }
}
@media (max-width: 479px) {
  .partner-form,
  .partner-form fieldset {
    gap: 20px;
  }
  .partner-intro {
    margin-bottom: 24px;
  }
}
</style>

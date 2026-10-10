<script setup lang="ts">
import type { SessionUser } from "~~/shared/types/account";
import { validateRegistration } from "~~/shared/utils/account";

usePageSeo(
  "Регистрация",
  "Создайте аккаунт Прохук: бонусы, личные данные и доступ к каталогу 18+.",
);
const form = reactive({
  lastName: "",
  firstName: "",
  middleName: "",
  dateOfBirth: "",
  phone: "",
  password: "",
  passwordConfirm: "",
  consent: false,
});
const errors = ref<Record<string, string>>({});
const failure = ref("");
const pending = ref(false);
const formElement = ref<HTMLFormElement>();
// Дата рождения печатается подряд в одном поле: 15062008 → 15.06.2008.
// Точки вставляются автоматически, переключаться между сегментами не нужно.
const birthDate = ref("");
function onBirthInput(value: string) {
  // Вставка ISO-даты из браузерного автозаполнения — переставляем сегменты.
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const raw = iso ? `${iso[3]}${iso[2]}${iso[1]}` : value.replace(/\D/g, "");
  const digits = raw.slice(0, 8);
  let formatted = digits.slice(0, 2);
  if (digits.length > 2) formatted += `.${digits.slice(2, 4)}`;
  if (digits.length > 4) formatted += `.${digits.slice(4, 8)}`;
  birthDate.value = formatted;
  form.dateOfBirth = formatted;
}

async function submit() {
  if (pending.value) return;
  failure.value = "";
  const validation = validateRegistration(form);
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
    const response = await $fetch<{ user: SessionUser }>("/api/auth/register", {
      method: "POST",
      body: validation.data,
      retry: 0,
    });
    setSessionUser(response.user);
    // Только технический факт успешной регистрации: персональные данные
    // (ФИО, телефон, дата рождения) в аналитику не передаются.
    trackEvent("account_registration_success");
    await navigateTo("/account");
  } catch (error) {
    const response = error as {
      statusCode?: number;
      data?: { data?: { errors?: Record<string, string> } };
    };
    if (response.statusCode === 422 && response.data?.data?.errors) {
      errors.value = response.data.data.errors;
      await nextTick();
      formElement.value
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    }
    failure.value =
      response.statusCode === 429
        ? "Слишком много попыток. Попробуйте через 15 минут."
        : response.statusCode === 409
          ? (response.data?.data?.errors?.phone ??
            "Регистрация с этим номером недоступна.")
          : "";
    if (!failure.value && !Object.keys(errors.value).length)
      failure.value = "Не удалось зарегистрироваться. Попробуйте позже.";
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <UiContainer class="page-shell auth-page">
    <UiBreadcrumbs
      :items="[{ label: 'Главная', to: '/' }, { label: 'Регистрация' }]"
    />
    <section class="auth-card auth-card--wide" aria-labelledby="register-title">
      <h1 id="register-title">Регистрация</h1>
      <p class="auth-intro">
        Личный кабинет Прохук: бонусы за покупки и изображения товаров для
        совершеннолетних. Все поля обязательны.
      </p>
      <form
        ref="formElement"
        class="auth-form"
        novalidate
        :aria-busy="pending"
        @submit.prevent="submit"
      >
        <fieldset :disabled="pending" class="auth-fields">
          <legend class="sr-only">Личные данные</legend>
          <UiField
            v-model="form.lastName"
            label="Фамилия"
            name="lastName"
            autocomplete="family-name"
            placeholder="Иванов"
            required
            maxlength="60"
            :error="errors.lastName"
          />
          <UiField
            v-model="form.firstName"
            label="Имя"
            name="firstName"
            autocomplete="given-name"
            placeholder="Иван"
            required
            maxlength="60"
            :error="errors.firstName"
          />
          <UiField
            v-model="form.middleName"
            label="Отчество"
            name="middleName"
            autocomplete="additional-name"
            placeholder="Иванович"
            required
            maxlength="60"
            :error="errors.middleName"
          />
          <UiField
            :model-value="birthDate"
            label="Дата рождения"
            name="dateOfBirth"
            type="text"
            inputmode="numeric"
            autocomplete="bday"
            placeholder="ДД.ММ.ГГГГ"
            required
            maxlength="10"
            hint="Например: 15062008. Изображения товаров в каталоге видны только совершеннолетним."
            :error="errors.dateOfBirth"
            @update:model-value="onBirthInput"
          />
          <UiField
            v-model="form.phone"
            label="Телефон"
            name="phone"
            type="tel"
            autocomplete="tel"
            placeholder="+7 (999) 123-45-67"
            required
            maxlength="32"
            :error="errors.phone"
          />
          <UiField
            v-model="form.password"
            label="Пароль"
            name="password"
            type="password"
            autocomplete="new-password"
            placeholder="Минимум 8 символов"
            required
            maxlength="128"
            :error="errors.password"
          />
          <UiField
            v-model="form.passwordConfirm"
            label="Подтверждение пароля"
            name="passwordConfirm"
            type="password"
            autocomplete="new-password"
            placeholder="Повторите пароль"
            required
            maxlength="128"
            :error="errors.passwordConfirm"
          />
          <div>
            <UiCheckbox
              v-model="form.consent"
              name="consent"
              required
              label="Согласен(на) на обработку моих персональных данных (ФИО, дата рождения, телефон) для работы личного кабинета и бонусной программы."
              :aria-invalid="!!errors.consent"
            />
            <p class="field__help register-consent">
              Текст согласия —
              <NuxtLink to="/personal-data"
                >Согласие на обработку персональных данных</NuxtLink
              >, подробности —
              <NuxtLink to="/privacy"
                >Политика обработки персональных данных</NuxtLink
              >.
            </p>
            <p
              v-if="errors.consent"
              class="field__help field__help--error"
              role="alert"
            >
              {{ errors.consent }}
            </p>
          </div>
        </fieldset>
        <p v-if="failure" role="alert" class="auth-failure">
          {{ failure }}
        </p>
        <div class="auth-actions">
          <UiButton type="submit" size="large" :loading="pending">{{
            pending ? "Регистрируем…" : "Зарегистрироваться"
          }}</UiButton>
          <NuxtLink to="/login" class="auth-switch"
            >Уже есть аккаунт? Войти</NuxtLink
          >
        </div>
      </form>
    </section>
  </UiContainer>
</template>

<style scoped>
.auth-page {
  padding-bottom: var(--section-space);
}
.auth-card {
  margin-top: 32px;
  max-width: 480px;
  border: 1px solid var(--separator);
  border-radius: var(--radius-card);
  padding: clamp(24px, 4vw, 48px);
  background: var(--surface-subtle);
}
.auth-card--wide {
  max-width: 560px;
}
.auth-card h1 {
  font-size: clamp(36px, 4vw, 48px);
}
.auth-intro {
  margin: 16px 0 28px;
  color: var(--text-secondary);
  max-width: 44ch;
}
.auth-fields {
  display: grid;
  gap: 20px;
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
.auth-failure {
  margin-top: 20px;
  color: var(--ink);
  font-weight: var(--weight-medium);
}
.auth-actions {
  margin-top: 28px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 24px;
}
.auth-switch {
  font-size: var(--font-caption);
  text-decoration: underline;
}
.register-consent {
  margin-top: 10px;
}
@media (max-width: 479px) {
  .auth-actions > .button {
    width: 100%;
  }
  /* HIG 44×44: самостоятельная CTA-ссылка под кнопкой формы */
  .auth-switch {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
}
</style>

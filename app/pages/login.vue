<script setup lang="ts">
import type { SessionUser } from "~~/shared/types/account";
import { validateLogin } from "~~/shared/utils/account";

usePageSeo(
  "Вход в личный кабинет",
  "Войдите по номеру телефона и паролю, чтобы увидеть бонусы и личные данные.",
);
const form = reactive({ phone: "", password: "" });
const errors = ref<Record<string, string>>({});
const failure = ref("");
const pending = ref(false);
const formElement = ref<HTMLFormElement>();
const route = useRoute();
const target = computed(() => {
  const redirect =
    typeof route.query.redirect === "string" ? route.query.redirect : "";
  return redirect.startsWith("/") && !redirect.startsWith("//")
    ? redirect
    : "/account";
});

async function submit() {
  if (pending.value) return;
  failure.value = "";
  const validation = validateLogin(form);
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
    const response = await $fetch<{ user: SessionUser }>("/api/auth/login", {
      method: "POST",
      body: validation.data,
      retry: 0,
    });
    setSessionUser(response.user);
    // Только технический факт успешного входа: без телефона, имени и
    // иных персональных данных.
    trackEvent("account_login_success");
    await navigateTo(target.value);
  } catch (error) {
    const response = error as {
      statusCode?: number;
      data?: { data?: { errors?: Record<string, string>; message?: string } };
    };
    if (response.statusCode === 422 && response.data?.data?.errors)
      errors.value = response.data.data.errors;
    failure.value =
      response.statusCode === 429
        ? "Слишком много попыток входа. Попробуйте через 15 минут."
        : (response.data?.data?.message ?? "Неверный телефон или пароль.");
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <UiContainer class="page-shell auth-page">
    <UiBreadcrumbs
      :items="[{ label: 'Главная', to: '/' }, { label: 'Вход' }]"
    />
    <section class="auth-card" aria-labelledby="login-title">
      <h1 id="login-title">Вход</h1>
      <p class="auth-intro">
        Войдите по номеру телефона, чтобы видеть бонусы и личные данные.
      </p>
      <form
        ref="formElement"
        class="auth-form"
        novalidate
        :aria-busy="pending"
        @submit.prevent="submit"
      >
        <fieldset :disabled="pending" class="auth-fields">
          <legend class="sr-only">Телефон и пароль</legend>
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
            autocomplete="current-password"
            placeholder="••••••••"
            required
            maxlength="128"
            :error="errors.password"
          />
        </fieldset>
        <p v-if="failure" role="alert" class="auth-failure">
          {{ failure }}
        </p>
        <div class="auth-actions">
          <UiButton type="submit" size="large" :loading="pending">{{
            pending ? "Входим…" : "Войти"
          }}</UiButton>
          <NuxtLink to="/register" class="auth-switch"
            >Нет аккаунта? Зарегистрироваться</NuxtLink
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
.auth-card h1 {
  font-size: clamp(36px, 4vw, 48px);
}
.auth-intro {
  margin: 16px 0 28px;
  color: var(--text-secondary);
  max-width: 40ch;
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

<script setup lang="ts">
/**
 * Виджет Yandex SmartCaptcha. Публичный sitekey попадает в клиент из
 * NUXT_PUBLIC_SMARTCAPTCHA_CLIENT_KEY; проверка токена выполняется только
 * на сервере (POST /api/reservations → SMARTCAPTCHA_SERVER_KEY). Без ключа
 * виджет не рендерится (локальная разработка и тесты).
 */
interface SmartCaptchaApi {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
    },
  ) => string | number;
  reset: (widgetId: string | number) => void;
}

const emit = defineEmits<{ passed: [token: string]; failed: [] }>();
const props = defineProps<{ resetSignal?: number }>();

const { public: config } = useRuntimeConfig();
const siteKey = config.smartCaptchaClientKey as string;
const container = ref<HTMLDivElement>();
let widgetId: string | number | undefined;

function windowApi(): SmartCaptchaApi | undefined {
  return (window as unknown as { smartCaptcha?: SmartCaptchaApi }).smartCaptcha;
}

function render() {
  const api = windowApi();
  if (!api || !container.value || widgetId !== undefined) return;
  widgetId = api.render(container.value, {
    sitekey: siteKey,
    callback: (token) => emit("passed", token),
    "error-callback": () => emit("failed"),
    "expired-callback": () => {
      emit("failed");
      api.reset(widgetId!);
    },
  });
}

watch(
  () => props.resetSignal,
  () => {
    if (widgetId !== undefined) windowApi()?.reset(widgetId);
  },
);

onMounted(() => {
  if (!siteKey) return;
  if (windowApi()) {
    render();
    return;
  }
  const script = document.createElement("script");
  script.src = "https://smartcaptcha.ru/captcha.js";
  script.async = true;
  script.defer = true;
  script.addEventListener("load", render);
  script.addEventListener("error", () => emit("failed"));
  document.head.appendChild(script);
});
</script>

<template>
  <div v-if="siteKey" ref="container" class="smart-captcha" />
</template>

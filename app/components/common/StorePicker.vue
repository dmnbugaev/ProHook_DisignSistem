<script setup lang="ts">
import type { GeoErrorCode } from "~~/app/composables/useStoreSelection";
const { data: meta, error, refresh, status } = await useCatalogMeta();
const {
  store,
  pickerOpen,
  select,
  detect,
  detecting,
  detectError,
  dismissPicker,
} = useStoreSelection();
const cityId = ref("");
const stores = computed(
  () => meta.value?.stores.filter((item) => item.cityId === cityId.value) ?? [],
);
const cityOptions = computed(() => [
  { value: "", label: "Выберите город" },
  ...(meta.value?.cities.map((city) => ({
    value: city.id,
    label: city.name,
  })) ?? []),
]);
watch(
  pickerOpen,
  (open) => {
    if (open) cityId.value = store.value?.cityId ?? "";
  },
  { immediate: true },
);
// Магазин применяется сразу при выборе — отдельная кнопка не нужна.
function choose(id: string) {
  select(id);
}
// Любое закрытие без выбора магазина запоминаем, чтобы автоподстановка не
// открывала окно заново на каждом маршруте до конца сессии.
watch(pickerOpen, (open, was) => {
  if (was && !open && !store.value) dismissPicker();
});
// Сообщение об ошибке показываем только после ручной попытки: автодетект при
// первом визите мог честно не получить разрешение — это не повод пугать.
const attempted = ref(false);
async function detectHere() {
  attempted.value = true;
  const id = await detect({ force: true });
  if (id) cityId.value = store.value?.cityId ?? cityId.value;
}
const errorTexts: Record<GeoErrorCode, string> = {
  denied:
    "Браузер запретил доступ к геолокации. Разрешите её в настройках сайта (значок замка в адресной строке) и нажмите кнопку ещё раз — или выберите город из списка.",
  timeout:
    "Не удалось получить координаты за отведённое время. Попробуйте ещё раз или выберите город из списка.",
  unavailable:
    "Не удалось определить местоположение. Выберите город и магазин из списка.",
  insecure:
    "Геолокация работает только на защищённом соединении (HTTPS). Выберите город и магазин из списка.",
};
</script>
<template>
  <UiDialog v-model="pickerOpen" title="Ваш город и магазин">
    <p class="caption">Цена зависит от города, наличие — от выбранной точки.</p>
    <UiEmptyState v-if="error" title="Не удалось загрузить магазины">
      Попробуйте ещё раз.<template #action
        ><UiButton :loading="status === 'pending'" @click="refresh()"
          >Повторить</UiButton
        ></template
      >
    </UiEmptyState>
    <div v-else class="store-picker">
      <UiButton variant="secondary" :loading="detecting" @click="detectHere">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 21s-6.5-5.5-6.5-10.5a6.5 6.5 0 1 1 13 0C18.5 15.5 12 21 12 21Z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          />
          <circle cx="12" cy="10.5" r="2.25" fill="currentColor" />
        </svg>
        Определить по геолокации</UiButton
      >
      <p
        v-if="attempted && detectError"
        class="field__help"
        role="status"
        aria-live="polite"
      >
        {{ errorTexts[detectError] }}
      </p>
      <UiSelect v-model="cityId" label="Город" :options="cityOptions" />
      <fieldset v-if="cityId" class="store-options">
        <legend>Магазин</legend>
        <label
          v-for="item in stores"
          :key="item.id"
          class="store-option"
          :class="{ 'store-option--selected': store?.id === item.id }"
        >
          <input
            type="radio"
            name="store"
            :value="item.id"
            :checked="store?.id === item.id"
            @change="choose(item.id)"
          />
          <span
            ><strong>{{ item.name }}</strong
            ><span class="caption">{{
              item.address || item.description
            }}</span></span
          >
        </label>
      </fieldset>
      <p class="caption store-picker__hint">
        Окно можно закрыть и выбрать магазин позже — тогда цены покажутся
        минимальные по городам.
      </p>
    </div>
  </UiDialog>
</template>

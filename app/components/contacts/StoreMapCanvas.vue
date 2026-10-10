<script setup lang="ts">
import type { StoreLocation } from "~~/shared/types/store";
import { prohookContacts } from "~~/shared/content/prohook";
import { storeCities } from "~~/shared/content/stores";

// Минимальные типы JS API Яндекс.Карт 2.1: описана только используемая
// часть интерфейса, отдельного пакета типов в проекте нет.
interface YmapsEventManager {
  add(type: string, handler: () => void): void;
}
interface YmapsMap {
  setBounds(bounds: number[][], options?: Record<string, unknown>): void;
  setCenter(
    center: [number, number],
    zoom?: number,
    options?: Record<string, unknown>,
  ): void;
  getZoom(): number;
  destroy(): void;
  container: { fitToViewport(): void };
  behaviors: { enable(name: string): void; disable(name: string): void };
  balloon: { close(): void };
  controls: { add(name: string, options?: Record<string, unknown>): void };
  events: YmapsEventManager;
  geoObjects: {
    add(object: YmapsPlacemark): void;
    getBounds(): number[][] | null;
  };
}
interface YmapsPlacemark {
  properties: { set(name: string, value: unknown): void };
  options: { set(name: string, value: unknown): void };
  balloon: { open(): void };
  events: YmapsEventManager;
}
interface YmapsApi {
  ready(callback: () => void): void;
  Map: new (
    container: HTMLElement,
    state: {
      center: [number, number];
      zoom: number;
      controls?: string[];
      behaviors?: string[];
    },
  ) => YmapsMap;
  Placemark: new (
    coordinates: [number, number],
    properties: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => YmapsPlacemark;
  templateLayoutFactory: { createClass(template: string): unknown };
}
declare global {
  interface Window {
    ymaps?: YmapsApi;
  }
}

const props = defineProps<{
  stores: StoreLocation[];
  selectedId: string | null;
}>();
const emit = defineEmits<{ select: [id: string] }>();

const config = useRuntimeConfig();
const containerEl = ref<HTMLElement | null>(null);
const status = ref<"loading" | "ready" | "error">("loading");

// Карта и маркеры живут вне реактивности Vue: API сам управляет своими
// DOM-узлами, повторный рендер компонента им не нужен.
let map: YmapsMap | null = null;
const placemarks = new Map<string, YmapsPlacemark>();
// Наблюдатель ленивой инициализации (отключается после первого срабатывания).
let mapObserver: IntersectionObserver | null = null;

// SDK грузится одним скриптом на страницу, сколько бы карт ни было.
let ymapsPromise: Promise<YmapsApi> | null = null;
const loadYmaps = (): Promise<YmapsApi> => {
  if (ymapsPromise) {
    return ymapsPromise;
  }
  ymapsPromise = new Promise<YmapsApi>((resolve, reject) => {
    const loaded = window.ymaps;
    if (loaded) {
      loaded.ready(() => resolve(loaded));
      return;
    }
    const script = document.createElement("script");
    const params = new URLSearchParams({ lang: "ru_RU" });
    // Ключ публичный (виден в адресе скрипта) и необязательный: без него
    // карта работает, API лишь предупреждает в консоли. Официально ключ
    // выдаётся бесплатно на developer.tech.yandex.ru; в Git не попадает.
    const apiKey = config.public.yandexMapsApiKey;
    if (apiKey) {
      params.set("apikey", apiKey);
    }
    script.src = `https://api-maps.yandex.ru/2.1/?${params.toString()}`;
    script.async = true;
    const watchdog = window.setTimeout(() => {
      ymapsPromise = null;
      reject(new Error("API Яндекс.Карт не ответил за 20 секунд"));
    }, 20000);
    script.addEventListener("error", () => {
      window.clearTimeout(watchdog);
      ymapsPromise = null;
      reject(new Error("Не удалось загрузить скрипт Яндекс.Карт"));
    });
    script.addEventListener("load", () => {
      const api = window.ymaps;
      if (!api) {
        window.clearTimeout(watchdog);
        ymapsPromise = null;
        reject(new Error("Скрипт Яндекс.Карт загрузился без API"));
        return;
      }
      api.ready(() => {
        window.clearTimeout(watchdog);
        resolve(api);
      });
    });
    document.head.append(script);
  });
  return ymapsPromise;
};

const cityName = (cityId: string) =>
  storeCities.find((city) => city.id === cityId)?.name ?? cityId;

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildPopupHtml = (store: StoreLocation) => {
  const rows = [
    `<strong>${escapeHtml(store.name)}</strong>`,
    `<span class="caption">${escapeHtml(`${cityName(store.cityId)}, ${store.address}`)}</span>`,
    ...(store.district
      ? [`<span class="caption">${escapeHtml(store.district)}</span>`]
      : []),
    `<span class="caption">Режим: ${escapeHtml(store.hours ?? prohookContacts.hours)}</span>`,
  ];
  return `<div class="store-popup-card">${rows.join("")}</div>`;
};

const updateSelection = (id: string | null) => {
  for (const [markerId, placemark] of placemarks) {
    placemark.properties.set("selected", markerId === id);
    placemark.options.set("zIndex", markerId === id ? 1000 : 100);
  }
  if (!map) {
    return;
  }
  if (!id) {
    map.balloon.close();
    return;
  }
  const placemark = placemarks.get(id);
  const store = props.stores.find((item) => item.id === id);
  if (!placemark || !store?.coordinates) {
    return;
  }
  const target: [number, number] = [store.coordinates[1], store.coordinates[0]];
  map.setCenter(target, Math.max(map.getZoom(), 16), {
    duration: prefersReducedMotion() ? 0 : 400,
  });
  placemark.balloon.open();
};

const init = async () => {
  if (!containerEl.value) {
    return;
  }
  status.value = "loading";
  try {
    const ymaps = await loadYmaps();
    if (!containerEl.value) {
      return; // компонент размонтировали, пока грузился SDK
    }
    map?.destroy();
    placemarks.clear();

    const mapInstance = new ymaps.Map(containerEl.value, {
      // Саратов — стартовая точка до подгонки обзора по всем магазинам.
      center: [51.5336, 46.0343],
      zoom: 11,
      controls: [],
      // Колесо мыши подключается после фокуса или клика по карте, чтобы
      // прокрутка страницы не перехватывалась (см. слушатели в onMounted).
      behaviors: ["drag", "multiTouch"],
    });
    map = mapInstance;
    mapInstance.controls.add("zoomControl", { size: "small" });
    mapInstance.events.add("sizechange", () =>
      mapInstance.container.fitToViewport(),
    );

    // Классы API содержат номер сборки (ymaps-2-1-79-…), поэтому стили
    // навешиваются на собственные классы внутри макета (см. catalog.css).
    const iconLayout = ymaps.templateLayoutFactory.createClass(
      '<div class="store-pin-anchor" title="$[properties.title]">' +
        '<span class="store-pin{% if properties.selected %} store-pin--selected{% endif %}" aria-hidden="true"></span>' +
        "</div>",
    );

    for (const store of props.stores) {
      const coordinates = store.coordinates;
      if (!coordinates) {
        continue;
      }
      const placemark = new ymaps.Placemark(
        [coordinates[1], coordinates[0]],
        {
          title: `${store.name} — ${cityName(store.cityId)}, ${store.address}`,
          balloonContentBody: buildPopupHtml(store),
          selected: false,
        },
        {
          iconLayout,
          // Зона клика вокруг «капли» в пикселях от якорной точки.
          iconShape: {
            type: "Rectangle",
            coordinates: [
              [-13, -30],
              [13, 4],
            ],
          },
          iconOffset: [-11, -26],
          iconCursor: "pointer",
          zIndex: 100,
          hideIconOnBalloonOpen: false,
          balloonShadow: false,
          balloonOffset: [0, -26],
          balloonPanelMaxMapArea: 0,
          balloonMinWidth: 220,
          balloonMaxWidth: 320,
        },
      );
      placemark.events.add("click", () => emit("select", store.id));
      mapInstance.geoObjects.add(placemark);
      placemarks.set(store.id, placemark);
    }

    const bounds = mapInstance.geoObjects.getBounds();
    if (bounds) {
      mapInstance.setBounds(bounds, {
        checkZoomRange: true,
        zoomMargin: [32, 32],
        duration: 0,
      });
    }

    status.value = "ready";
    updateSelection(props.selectedId);
  } catch (error) {
    console.error("[stores-map] не удалось инициализировать карту:", error);
    status.value = "error";
  }
};

const enableWheelZoom = () => map?.behaviors.enable("scrollZoom");
const disableWheelZoom = () => map?.behaviors.disable("scrollZoom");

onMounted(() => {
  const container = containerEl.value;
  if (container) {
    container.addEventListener("focusin", enableWheelZoom);
    container.addEventListener("focusout", disableWheelZoom);
    container.addEventListener("pointerdown", enableWheelZoom);
    container.addEventListener("mouseleave", disableWheelZoom);
  }
  // Карта инициализируется при приближении к вьюпорту: SDK и тайлы
  // (~1 МБ) не конкурируют с загрузкой контента страницы и не качаются
  // тем, кто не доскроллил (см. замеры в SEO_IMPLEMENTATION_REPORT.md).
  if (container && "IntersectionObserver" in window) {
    mapObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        mapObserver?.disconnect();
        mapObserver = null;
        void init();
      },
      { rootMargin: "400px" },
    );
    mapObserver.observe(container);
  } else {
    void init();
  }
});

watch(
  () => props.selectedId,
  (id) => updateSelection(id),
);

onBeforeUnmount(() => {
  const container = containerEl.value;
  if (container) {
    container.removeEventListener("focusin", enableWheelZoom);
    container.removeEventListener("focusout", disableWheelZoom);
    container.removeEventListener("pointerdown", enableWheelZoom);
    container.removeEventListener("mouseleave", disableWheelZoom);
  }
  mapObserver?.disconnect();
  mapObserver = null;
  map?.destroy();
  map = null;
  placemarks.clear();
});
</script>

<template>
  <div class="stores-map-canvas">
    <p class="sr-only">
      Интерактивная карта магазинов на Яндекс.Картах. Полный список адресов
      находится в списке рядом; карта — вспомогательный способ навигации.
    </p>
    <div
      ref="containerEl"
      class="stores-map-view"
      role="application"
      tabindex="0"
      aria-label="Карта магазинов Прохук (Яндекс Карты)"
    />
    <div
      v-if="status !== 'ready'"
      class="stores-map-overlay"
      aria-live="polite"
    >
      <p v-if="status === 'loading'" class="caption">Загружаем карту…</p>
      <template v-else>
        <p class="caption">
          Не удалось загрузить карту. Адреса магазинов доступны в списке рядом.
        </p>
        <UiButton variant="secondary" @click="init">Повторить</UiButton>
      </template>
    </div>
  </div>
</template>

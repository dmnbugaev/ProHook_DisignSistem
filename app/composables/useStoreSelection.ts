import type { CatalogMeta } from "~~/shared/types/catalog";
import type { Store } from "~~/shared/types/store";

/** Расстояние между точками в км (гаверсинус). */
function distanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Магазин сети, ближайший к позиции пользователя (по координатам meta). */
export function nearestStore(
  stores: Store[],
  position: { lat: number; lng: number },
): Store | undefined {
  let best: Store | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const store of stores) {
    if (!store.coordinates) continue;
    const [lng, lat] = store.coordinates;
    const distance = distanceKm(position, { lat, lng });
    if (distance < bestDistance) {
      best = store;
      bestDistance = distance;
    }
  }
  return best;
}

/** Причина, по которой геолокация не сработала — для понятного сообщения. */
export type GeoErrorCode = "denied" | "timeout" | "unavailable" | "insecure";

export function useStoreSelection() {
  const storeId = useCookie<string | null>("prohook-store", {
    default: () => null,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  const pickerOpen = useState("store-picker-open", () => false);
  /** Ненадолго показываем: магазин подставлен автоматически по геолокации. */
  const autoDetected = useState("store-auto-detected", () => false);
  const detecting = useState("store-detecting", () => false);
  const detectError = useState<GeoErrorCode | null>(
    "store-detect-error",
    () => null,
  );
  /**
   * Пользователь закрыл диалог выбора без магазина. Автоподстановка больше не
   * открывает окно заново до конца сессии браузера; открыть вручную можно в
   * любой момент из шапки. Session-cookie (без maxAge) видна и SSR, поэтому
   * сервер не рендерит окно открытым после отказа.
   */
  const dismissedCookie = useCookie<boolean | null>("prohook-picker-dismissed", {
    sameSite: "lax",
    default: () => null,
  });
  const pickerDismissed = computed(() => dismissedCookie.value === true);
  const { data: meta } = useNuxtData<CatalogMeta>("catalog-meta");
  const store = computed(() =>
    meta.value?.stores.find((item) => item.id === storeId.value),
  );
  const city = computed(() =>
    meta.value?.cities.find((item) => item.id === store.value?.cityId),
  );
  function select(id: string) {
    if (!meta.value?.stores.some((item) => item.id === id)) return;
    storeId.value = id;
    autoDetected.value = false;
    dismissedCookie.value = null;
    pickerOpen.value = false;
  }
  function dismissPicker() {
    dismissedCookie.value = true;
    pickerOpen.value = false;
  }
  /** Идущий запрос геолокации: ручная кнопка ждёт его, а не делает второй. */
  const inFlight = useState<Promise<string | null> | null>(
    "store-detect-inflight",
    () => null,
  );
  /**
   * Запрос геолокации и автоподбор ближайшего магазина. Автоматический вызов
   * срабатывает один раз за сессию браузера (force — для ручной кнопки),
   * повторные визиты живут на cookie выбранного магазина. Параллельный вызов
   * (ручная кнопка во время автомата) доит уже идущий запрос, а не молчит.
   * Возвращает id выбранного магазина или null (отказ/нет координат).
   */
  async function detect(
    options: { force?: boolean } = {},
  ): Promise<string | null> {
    if (!import.meta.client) return null;
    // Автодетект не трогает уже выбранный магазин; ручная кнопка (force)
    // должна уметь переопределить выбор заново.
    if (!options.force && storeId.value) return null;
    try {
      if (!options.force && sessionStorage.getItem("prohook-geo-tried"))
        return null;
      sessionStorage.setItem("prohook-geo-tried", "1");
    } catch {
      // Приватный режим: просто не мемоизируем попытку.
    }
    if (inFlight.value) return inFlight.value;
    if (!window.isSecureContext) {
      detectError.value = "insecure";
      return null;
    }
    if (!("geolocation" in navigator)) {
      detectError.value = "unavailable";
      return null;
    }
    detecting.value = true;
    detectError.value = null;
    // Запоминаем выбор на момент старта: если пользователь вручную сменил
    // магазин, пока шёл запрос, его выбор не перетираем найденным.
    const storeAtStart = storeId.value;
    const request = (async () => {
      try {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 8000,
              maximumAge: 10 * 60 * 1000,
            });
          },
        );
        const found = nearestStore(meta.value?.stores ?? [], {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        if (storeId.value !== storeAtStart) return null;
        if (!found) {
          detectError.value = "unavailable";
          return null;
        }
        storeId.value = found.id;
        autoDetected.value = true;
        dismissedCookie.value = null;
        pickerOpen.value = false;
        return found.id;
      } catch (error) {
        const code = (error as GeolocationPositionError | undefined)?.code;
        detectError.value =
          code === 1 ? "denied" : code === 3 ? "timeout" : "unavailable";
        return null;
      } finally {
        detecting.value = false;
        inFlight.value = null;
      }
    })();
    inFlight.value = request;
    return request;
  }
  return {
    storeId,
    store,
    city,
    pickerOpen,
    pickerDismissed,
    autoDetected,
    detecting,
    detectError,
    select,
    dismissPicker,
    detect,
  };
}

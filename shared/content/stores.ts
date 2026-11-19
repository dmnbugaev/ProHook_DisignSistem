import type { City, StoreLocation } from "~~/shared/types/store";
import storeCoordinatesJson from "./store-coordinates.json";

/**
 * Публичный список физических точек сети для страницы контактов.
 * Адреса предоставлены владельцем (2026-10-05) и согласованы с
 * server/data/store-addresses.ts (учётная система МойСклад).
 *
 * Координаты лежат в store-coordinates.json: их заполняет и обновляет
 * `npm run stores:geocode` (только российские сервисы: Яндекс и 2ГИС,
 * по ключу из env) либо вносят вручную с публичной Яндекс.Карты — так
 * заполнены точки без API-геокодирования. Точка без записи в sidecar
 * остаётся в списке, но без маркера на карте.
 */

interface StoreGeoEntry {
  /** [долгота, широта] — тот же порядок, что у API 2ГИС и Геокодера Яндекса. */
  coordinates: [number, number];
  /** "yandex" | "2gis" | "manual" | "nominatim" (последний — исторические). */
  source: string;
  /** Полный адрес, который вернул геокодер (для сверки). */
  resolved?: string;
  /** Дата геокодировки (ISO). */
  geocodedAt?: string;
  /** Ссылка на карточку в 2ГИС — появляется после геокодировки через 2ГИС. */
  mapsUrl?: string;
}

// Sidecar генерируется npm run stores:geocode; JSON-импорт даёт number[],
// поэтому приводим через unknown к кортежу [долгота, широта].
const geoById = storeCoordinatesJson as unknown as Record<
  string,
  StoreGeoEntry
>;

export const storeCities: readonly City[] = [
  { id: "saratov", name: "Саратов" },
  { id: "engels", name: "Энгельс" },
  { id: "moscow", name: "Москва" },
];

type StoreLocationDraft = Omit<StoreLocation, "coordinates" | "geoSource">;

// Часы работы точек — сообщение владельца 19.11.2026: общего режима сети
// нет, у каждой точки свой режим. Значения синхронизированы с
// server/data/store-hours.ts (сверку делает tests/stores-data.test.mjs);
// формат строк совместим с parseOpeningHours (Schema.org openingHours).
const STORE_HOURS = {
  /** Большинство точек сети (Саратов, Энгельс, две московские). */
  standard: "Ежедневно, 10:00–22:00",
  /** Антонова, 33; Большая Казачья, 103; Вокзал (Аткарская, 66а). */
  early: "Ежедневно, 9:00–22:00",
  /** Крымская, 9 — короткий день. */
  short: "Ежедневно, 9:00–21:00",
  /** Боброво (Москва) работает дольше остальных. */
  bobrovo: "Ежедневно, 10:00–23:00",
} as const;

const storeDrafts: readonly StoreLocationDraft[] = [
  // Саратов — 25 точек.
  {
    id: "saratov-antonova-33",
    cityId: "saratov",
    name: "ул. Антонова, 33",
    address: "ул. Антонова, 33",
    hours: STORE_HOURS.early,
  },
  {
    id: "saratov-sadovaya-2-99",
    cityId: "saratov",
    name: "ул. 2-я Садовая, 99",
    address: "ул. 2-я Садовая, 99",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-stolypina-13",
    cityId: "saratov",
    name: "Проспект имени Петра Столыпина, 13",
    address: "Проспект имени Петра Столыпина, 13",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-stroiteley-15",
    cityId: "saratov",
    name: "Проспект Строителей, 15",
    address: "Проспект Строителей, 15",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-menyakina-4",
    cityId: "saratov",
    name: "ул. Менякина, 4",
    address: "ул. Менякина, 4",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-krymskaya-9",
    cityId: "saratov",
    name: "ул. Крымская, 9",
    address: "ул. Крымская, 9",
    hours: STORE_HOURS.short,
  },
  {
    id: "saratov-tulskaya-49d",
    cityId: "saratov",
    name: "ул. Тульская, 49д",
    address: "ул. Тульская, 49д",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-kazachya-103",
    cityId: "saratov",
    name: "ул. Большая Казачья, 103",
    address: "ул. Большая Казачья, 103",
    hours: STORE_HOURS.early,
  },
  {
    // Точка переехала с ул. Чапаева, 45 (старая публикация о переезде);
    // владелец подтвердил адрес «Мичурина, 51» 10.10.2026. Координаты по
    // старому адресу удалены — ждём актуальные (npm run stores:geocode).
    id: "saratov-michurina-51",
    cityId: "saratov",
    name: "ул. Мичурина, 51",
    address: "ул. Мичурина, 51",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-zhukovskogo-6",
    cityId: "saratov",
    name: "ул. Жуковского, 6",
    address: "ул. Жуковского, 6",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-50-let-oktyabrya-89",
    cityId: "saratov",
    name: "Проспект имени 50 лет Октября, 89",
    address: "Проспект имени 50 лет Октября, 89",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-gornaya-340a",
    cityId: "saratov",
    name: "ул. Большая Горная, 340а",
    address: "ул. Большая Горная, 340а",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-ogorodnaya-144-2",
    cityId: "saratov",
    name: "ул. Огородная, 144/2",
    address: "ул. Огородная, 144/2",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-burovaya-25",
    cityId: "saratov",
    name: "ул. Буровая, 25",
    address: "ул. Буровая, 25",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-tarkhova-39",
    cityId: "saratov",
    name: "ул. Тархова, 39",
    address: "ул. Тархова, 39",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-panchenko-4-5",
    cityId: "saratov",
    name: "ул. Панченко, 4/5",
    address: "ул. Панченко, 4/5",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-chernyshevskogo-67",
    cityId: "saratov",
    name: "ул. Чернышевского, 67",
    address: "ул. Чернышевского, 67",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-entuziastov-26",
    cityId: "saratov",
    name: "ул. Энтузиастов, 26",
    address: "ул. Энтузиастов, 26",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-stroiteley-84a",
    cityId: "saratov",
    name: "Проспект Строителей, 84а",
    address: "Проспект Строителей, 84а",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-alekseevskaya-7b",
    cityId: "saratov",
    name: "ул. Алексеевская, 7б",
    address: "ул. Алексеевская, 7б",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-entuziastov-54b",
    cityId: "saratov",
    name: "ул. Энтузиастов, 54б",
    address: "ул. Энтузиастов, 54б",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-azina-39",
    cityId: "saratov",
    name: "ул. Азина, 39",
    address: "ул. Азина, 39",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-gvardeyskaya-26",
    cityId: "saratov",
    name: "ул. Гвардейская, 26",
    address: "ул. Гвардейская, 26",
    hours: STORE_HOURS.standard,
  },
  {
    id: "saratov-atkarskaya-66a",
    cityId: "saratov",
    name: "ул. Аткарская, 66а",
    address: "ул. Аткарская, 66а",
    hours: STORE_HOURS.early,
  },
  {
    id: "saratov-chapaeva-1-5",
    cityId: "saratov",
    name: "ул. Чапаева В.И., 1/5",
    address: "ул. Чапаева В.И., 1/5",
    hours: STORE_HOURS.standard,
  },
  // Энгельс — 2 точки (организации «ПроХук» на ул. Тельмана подтверждены
  // публичной Яндекс.Картой, см. docs/STORE-MAPPING.md; в учёте МойСклад
  // они лежат в группе «Саратов»).
  {
    id: "engels-telmana-29",
    cityId: "engels",
    name: "ул. Тельмана, 29",
    address: "ул. Тельмана, 29",
    hours: STORE_HOURS.standard,
  },
  {
    id: "engels-telmana-6",
    cityId: "engels",
    name: "ул. Тельмана, 6",
    address: "ул. Тельмана, 6",
    hours: STORE_HOURS.standard,
  },
  // Москва — 3 точки. Названия учётные, адреса подтверждены владельцем.
  {
    id: "moscow-sombrero-yangelya",
    cityId: "moscow",
    name: "Сомбреро (Янгеля)",
    address: "Варшавское шоссе, 152а",
    district: "район Южное Чертаново",
    hours: STORE_HOURS.standard,
  },
  {
    id: "moscow-parkovy",
    cityId: "moscow",
    name: "Парковый",
    address: "3-я Парковая, вл. 57",
    district: "район Северное Измайлово",
    hours: STORE_HOURS.standard,
  },
  {
    id: "moscow-bobrovo",
    cityId: "moscow",
    name: "Боброво",
    address: "ул. Крымская, 1",
    district: "район Восточное Бутово",
    hours: STORE_HOURS.bobrovo,
  },
];

export const storeLocations: readonly StoreLocation[] = storeDrafts.map(
  (store) => {
    const geo = geoById[store.id];
    if (!geo) {
      return store;
    }
    return {
      ...store,
      coordinates: geo.coordinates,
      geoSource: geo.source,
      mapsUrl: store.mapsUrl ?? geo.mapsUrl,
    };
  },
);

export const storeLocationById = new Map(
  storeLocations.map((store) => [store.id, store]),
);

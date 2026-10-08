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
  { id: "moscow", name: "Москва" },
];

type StoreLocationDraft = Omit<StoreLocation, "coordinates" | "geoSource">;

const storeDrafts: readonly StoreLocationDraft[] = [
  // Саратов — 27 точек.
  {
    id: "saratov-antonova-33",
    cityId: "saratov",
    name: "ул. Антонова, 33",
    address: "ул. Антонова, 33",
  },
  {
    id: "saratov-sadovaya-2-99",
    cityId: "saratov",
    name: "ул. 2-я Садовая, 99",
    address: "ул. 2-я Садовая, 99",
  },
  {
    id: "saratov-telmana-29",
    cityId: "saratov",
    name: "ул. Тельмана, 29",
    address: "ул. Тельмана, 29",
  },
  {
    id: "saratov-stolypina-13",
    cityId: "saratov",
    name: "Проспект имени Петра Столыпина, 13",
    address: "Проспект имени Петра Столыпина, 13",
  },
  {
    id: "saratov-stroiteley-15",
    cityId: "saratov",
    name: "Проспект Строителей, 15",
    address: "Проспект Строителей, 15",
  },
  {
    id: "saratov-menyakina-4",
    cityId: "saratov",
    name: "ул. Менякина, 4",
    address: "ул. Менякина, 4",
  },
  {
    id: "saratov-krymskaya-9",
    cityId: "saratov",
    name: "ул. Крымская, 9",
    address: "ул. Крымская, 9",
  },
  {
    id: "saratov-tulskaya-49d",
    cityId: "saratov",
    name: "ул. Тульская, 49д",
    address: "ул. Тульская, 49д",
  },
  {
    id: "saratov-kazachya-103",
    cityId: "saratov",
    name: "ул. Большая Казачья, 103",
    address: "ул. Большая Казачья, 103",
  },
  {
    id: "saratov-telmana-6",
    cityId: "saratov",
    name: "ул. Тельмана, 6",
    address: "ул. Тельмана, 6",
  },
  {
    id: "saratov-chapaeva-45",
    cityId: "saratov",
    name: "ул. Чапаева, 45",
    address: "ул. Чапаева, 45",
  },
  {
    id: "saratov-zhukovskogo-6",
    cityId: "saratov",
    name: "ул. Жуковского, 6",
    address: "ул. Жуковского, 6",
  },
  {
    id: "saratov-50-let-oktyabrya-89",
    cityId: "saratov",
    name: "Проспект имени 50 лет Октября, 89",
    address: "Проспект имени 50 лет Октября, 89",
  },
  {
    id: "saratov-gornaya-340a",
    cityId: "saratov",
    name: "ул. Большая Горная, 340а",
    address: "ул. Большая Горная, 340а",
  },
  {
    id: "saratov-ogorodnaya-144-2",
    cityId: "saratov",
    name: "ул. Огородная, 144/2",
    address: "ул. Огородная, 144/2",
  },
  {
    id: "saratov-burovaya-25",
    cityId: "saratov",
    name: "ул. Буровая, 25",
    address: "ул. Буровая, 25",
  },
  {
    id: "saratov-tarkhova-39",
    cityId: "saratov",
    name: "ул. Тархова, 39",
    address: "ул. Тархова, 39",
  },
  {
    id: "saratov-panchenko-4-5",
    cityId: "saratov",
    name: "ул. Панченко, 4/5",
    address: "ул. Панченко, 4/5",
  },
  {
    id: "saratov-chernyshevskogo-67",
    cityId: "saratov",
    name: "ул. Чернышевского, 67",
    address: "ул. Чернышевского, 67",
  },
  {
    id: "saratov-entuziastov-26",
    cityId: "saratov",
    name: "ул. Энтузиастов, 26",
    address: "ул. Энтузиастов, 26",
  },
  {
    id: "saratov-stroiteley-84a",
    cityId: "saratov",
    name: "Проспект Строителей, 84а",
    address: "Проспект Строителей, 84а",
  },
  {
    id: "saratov-alekseevskaya-7b",
    cityId: "saratov",
    name: "ул. Алексеевская, 7б",
    address: "ул. Алексеевская, 7б",
  },
  {
    id: "saratov-entuziastov-54b",
    cityId: "saratov",
    name: "ул. Энтузиастов, 54б",
    address: "ул. Энтузиастов, 54б",
  },
  {
    id: "saratov-azina-39",
    cityId: "saratov",
    name: "ул. Азина, 39",
    address: "ул. Азина, 39",
  },
  {
    id: "saratov-gvardeyskaya-26",
    cityId: "saratov",
    name: "ул. Гвардейская, 26",
    address: "ул. Гвардейская, 26",
  },
  {
    id: "saratov-atkarskaya-66a",
    cityId: "saratov",
    name: "ул. Аткарская, 66а",
    address: "ул. Аткарская, 66а",
  },
  {
    id: "saratov-chapaeva-1-5",
    cityId: "saratov",
    name: "ул. Чапаева В.И., 1/5",
    address: "ул. Чапаева В.И., 1/5",
  },
  // Москва — 3 точки. Названия учётные, адреса подтверждены владельцем.
  {
    id: "moscow-sombrero-yangelya",
    cityId: "moscow",
    name: "Сомбреро (Янгеля)",
    address: "Варшавское шоссе, 152а",
    district: "район Южное Чертаново",
  },
  {
    id: "moscow-parkovy",
    cityId: "moscow",
    name: "Парковый",
    address: "3-я Парковая, вл. 57",
    district: "район Северное Измайлово",
  },
  {
    id: "moscow-bobrovo",
    cityId: "moscow",
    name: "Боброво",
    address: "ул. Крымская, 1",
    district: "район Восточное Бутово",
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

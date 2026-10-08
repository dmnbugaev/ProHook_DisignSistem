export interface City {
  id: string;
  name: string;
}
/**
 * Реквизиты лицензии на розничную продажу табачной и никотинсодержащей
 * продукции (186-ФЗ от 26.06.2026: с 01.10.2026 регионы начинают выдачу,
 * с 01.03.2027 торговля без лицензии запрещена). Поля заполняются владельцем
 * после получения лицензий — пустые не отображаются на сайте.
 */
export interface StoreLicense {
  number: string;
  issuedOn: string;
  validUntil: string;
  authority: string;
}
export interface Store {
  id: string;
  cityId: string;
  name: string;
  description: string;
  address?: string;
  hours?: string;
  license?: StoreLicense;
  /**
   * [долгота, широта] — для автоподбора ближайшего магазина по геолокации.
   * Заполняется из публичного справочника shared/content/stores.ts
   * по совпадению адреса; у точек без координат поле отсутствует.
   */
  coordinates?: [number, number];
}
/**
 * Физическая точка сети для блока «Наши магазины» на странице контактов.
 * Координаты — [долгота, широта] в порядке, который ждут геокодеры;
 * карта (JS API Яндекс.Карт) пересобирает в [lat, lng] самостоятельно.
 */
export interface StoreLocation {
  id: string;
  cityId: string;
  /** Короткое имя точки; для обычных магазинов совпадает с адресом. */
  name: string;
  /** Полный адрес: улица/проспект и дом, без города. */
  address: string;
  /** Район/ориентир — в основном для нестандартных названий точек. */
  district?: string;
  coordinates?: [number, number];
  /** Чем получены координаты: "yandex" | "2gis" | "manual". Отсутствует до верификации. */
  geoSource?: string;
  /** Ссылка на карточку во внешней карте (2ГИС/Яндекс), заполняется владельцем. */
  mapsUrl?: string;
  phone?: string;
  hours?: string;
}
export type Availability = "available" | "low" | "unavailable" | "unknown";
export interface StoreOffer {
  storeId: string;
  /** Integer minor currency units (kopecks). */
  price: number;
  currency: "RUB";
  availability: Availability;
}

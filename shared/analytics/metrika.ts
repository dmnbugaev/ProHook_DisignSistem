/**
 * Общая часть интеграции Яндекс.Метрики: решение о загрузке счётчика и
 * строгий перечень событий с допустимыми параметрами.
 *
 * Требования (SEO_COMPLIANCE_AUDIT.md, 152-ФЗ):
 * - в параметрах событий запрещены персональные данные и содержимое
 *   полей форм: только технические идентификаторы (storeId, scope,
 *   HTTP-статус, источник действия);
 * - события — технические и информационные, без рекламной семантики;
 *   события покупки/оформления для регулируемой продукции не создаются.
 */

export const METRIKA_COUNTER_ID = "113582832";

export type MetrikaMode = "auto" | "0" | "1";

export interface MetrikaDecisionInput {
  /** NUXT_PUBLIC_METRIKA_ENABLED: auto | 0 | 1. */
  setting: string | undefined;
  /** import.meta.prod (production-сборка). */
  prod: boolean;
  /** Имя хоста, с которого открыт сайт. */
  hostname: string;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function resolveMetrika(input: MetrikaDecisionInput): boolean {
  // NUXT_PUBLIC_METRIKA_ENABLED="1"/"0" приходит из env как number —
  // Nuxt приводит числовые значения переменных окружения.
  const setting = String(input.setting ?? "auto").trim() as MetrikaMode;
  if (setting === "1") return true;
  if (setting === "0") return false;
  // auto: только production-сборка на публичном домене — dev-сервер и
  // локальный preview не отправляют данных в счётчик.
  return input.prod && !LOCAL_HOSTS.has(input.hostname.toLowerCase());
}

/** Имена событий, разрешённые к отправке в Метрику. */
export const ANALYTICS_EVENTS = [
  "store_location_view",
  "store_map_open",
  "store_phone_click",
  "contacts_page_view",
  "store_hours_view",
  "account_login_success",
  "account_registration_success",
  "catalog_technical_error",
  "site_search_error",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** Параметры каждого события — закрытый allowlist. */
export const ANALYTICS_EVENT_PARAMS: Record<
  AnalyticsEventName,
  readonly string[]
> = {
  store_location_view: ["storeId", "source"],
  store_map_open: ["storeId"],
  store_phone_click: ["source"],
  contacts_page_view: [],
  store_hours_view: ["storeId"],
  account_login_success: [],
  account_registration_success: [],
  catalog_technical_error: ["scope", "status"],
  site_search_error: ["status"],
};

export type AnalyticsEventParams = Partial<Record<string, string | number>>;

/**
 * Вырезает параметры вне allowlist (защита от случайной передачи ПД).
 * Значения приводятся к строке/числу; объекты и массивы отбрасываются.
 */
export function sanitizeEventParams(
  name: AnalyticsEventName,
  params?: AnalyticsEventParams,
): AnalyticsEventParams | undefined {
  if (!params) return undefined;
  const allowed = ANALYTICS_EVENT_PARAMS[name];
  const clean: AnalyticsEventParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (!allowed.includes(key)) continue;
    if (typeof value === "string") clean[key] = value.slice(0, 64);
    else if (typeof value === "number" && Number.isFinite(value))
      clean[key] = value;
  }
  return Object.keys(clean).length ? clean : undefined;
}

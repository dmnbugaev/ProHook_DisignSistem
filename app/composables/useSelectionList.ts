import { RESERVATION_LIMITS } from "~~/shared/types/reservation";

/**
 * Список выбранных товаров (для запроса на резерв). Хранение — cookie
 * prohook-selection (30 дней, строго необходимая, как и prohook-store),
 * доступная и SSR — состояние переживает перезагрузку без второго
 * механизма хранения. Количество и состав — только подсказка UX: сервер
 * перепроверяет всё по снимку МойСклад.
 */
export interface SelectionEntry {
  productId: string;
  quantity: number;
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/**
 * Cookie читается как есть и могла быть повреждена (обрезанный JSON,
 * подмена содержимого через DevTools): каждое чтение проходит санитизацию,
 * чтобы битое значение не ломало страницу.
 */
function sanitize(value: unknown): SelectionEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const entries: SelectionEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const { productId, quantity } = raw as Record<string, unknown>;
    if (
      typeof productId !== "string" ||
      !ID_PATTERN.test(productId) ||
      seen.has(productId)
    )
      continue;
    const amount =
      typeof quantity === "number" && Number.isInteger(quantity)
        ? Math.min(RESERVATION_LIMITS.maxItemQuantity, Math.max(1, quantity))
        : 1;
    seen.add(productId);
    entries.push({ productId, quantity: amount });
    if (entries.length >= RESERVATION_LIMITS.maxItems) break;
  }
  return entries;
}

export function useSelectionList() {
  const cookie = useCookie<unknown>("prohook-selection", {
    default: () => [],
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  // Санитизированная копия для рендера; мутации пишутся обратно в cookie
  // только валидными данными.
  const entries = computed<SelectionEntry[]>({
    get: () => sanitize(cookie.value),
    set: (value) => {
      cookie.value = sanitize(value);
    },
  });

  const count = computed(() => entries.value.length);
  const totalQuantity = computed(() =>
    entries.value.reduce((sum, entry) => sum + entry.quantity, 0),
  );

  function quantityOf(productId: string): number {
    return (
      entries.value.find((entry) => entry.productId === productId)?.quantity ??
      0
    );
  }

  function add(productId: string): boolean {
    const current = entries.value;
    const entry = current.find((item) => item.productId === productId);
    if (entry) {
      if (entry.quantity >= RESERVATION_LIMITS.maxItemQuantity) return false;
      entries.value = current.map((item) =>
        item.productId === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      );
      return true;
    }
    if (current.length >= RESERVATION_LIMITS.maxItems) return false;
    entries.value = [...current, { productId, quantity: 1 }];
    return true;
  }

  function setQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      remove(productId);
      return;
    }
    entries.value = entries.value.map((item) =>
      item.productId === productId
        ? {
            ...item,
            quantity: Math.min(
              RESERVATION_LIMITS.maxItemQuantity,
              Math.max(1, Math.floor(quantity) || 1),
            ),
          }
        : item,
    );
  }

  function remove(productId: string): void {
    entries.value = entries.value.filter(
      (entry) => entry.productId !== productId,
    );
  }

  function clear(): void {
    entries.value = [];
  }

  return {
    entries,
    count,
    totalQuantity,
    quantityOf,
    add,
    setQuantity,
    remove,
    clear,
  };
}

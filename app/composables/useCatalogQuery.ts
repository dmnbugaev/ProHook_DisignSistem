import { parseCatalogQuery } from "~~/shared/utils/catalog-query";
export interface FilterValues {
  minPrice: string;
  maxPrice: string;
  available: boolean;
  photo: boolean;
}
export const EMPTY_FILTERS: FilterValues = {
  minPrice: "",
  maxPrice: "",
  available: true,
  photo: false,
};
export function useCatalogQuery(category: MaybeRefOrGetter<string> = "") {
  const route = useRoute();
  const router = useRouter();
  const { store } = useStoreSelection();
  const parsed = computed(() => parseCatalogQuery(route.query));
  /**
   * «Только в наличии» включён по умолчанию: без параметра в URL каталог
   * показывает товары, доступные в выбранном магазине. Явное available=0
   * снимает фильтр — тогда видны и позиции с нулевым остатком («Скоро в
   * наличии»).
   */
  const availableDefault = computed(() => route.query.available === undefined);
  const requestQuery = computed(() => ({
    ...(route.query as Record<string, string | string[] | undefined>),
    category: toValue(category) || undefined,
    storeId: store.value?.id,
    limit: 12,
    available: availableDefault.value
      ? "1"
      : String(route.query.available ?? ""),
  }));
  const values = computed<FilterValues>(() => ({
    minPrice: parsed.value.minPrice?.toString() ?? "",
    maxPrice: parsed.value.maxPrice?.toString() ?? "",
    available: availableDefault.value ? true : parsed.value.available,
    photo: parsed.value.photo,
  }));
  const activeCount = computed(
    () =>
      Number(!!values.value.minPrice || !!values.value.maxPrice) +
      Number(values.value.available) +
      Number(values.value.photo),
  );
  function apply(filters: Partial<FilterValues>) {
    const next = { ...values.value, ...filters };
    return router.push({
      query: {
        ...route.query,
        page: undefined,
        minPrice: next.minPrice || undefined,
        maxPrice: next.maxPrice || undefined,
        available: next.available ? "1" : "0",
        photo: next.photo ? "1" : undefined,
        material: undefined,
        brand: undefined,
      },
    });
  }
  function reset() {
    return apply(EMPTY_FILTERS);
  }
  function sort(value: string) {
    return router.push({
      query: {
        ...route.query,
        sort: value === "popular" ? undefined : value,
        page: undefined,
      },
    });
  }
  watch(
    () => store.value?.id,
    () => {
      if (route.query.page)
        void router.replace({ query: { ...route.query, page: undefined } });
    },
  );
  return { parsed, requestQuery, values, activeCount, apply, reset, sort };
}

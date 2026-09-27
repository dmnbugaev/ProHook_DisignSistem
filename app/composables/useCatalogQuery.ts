import { parseCatalogQuery } from "~~/shared/utils/catalog-query";
export interface FilterValues {
  minPrice: string;
  maxPrice: string;
  available: boolean;
}
export function useCatalogQuery(category: MaybeRefOrGetter<string> = "") {
  const route = useRoute();
  const router = useRouter();
  const { store } = useStoreSelection();
  const parsed = computed(() => parseCatalogQuery(route.query));
  const requestQuery = computed(() => ({
    ...(route.query as Record<string, string | string[] | undefined>),
    category: toValue(category) || undefined,
    storeId: store.value?.id,
    limit: 12,
  }));
  const values = computed<FilterValues>(() => ({
    minPrice: parsed.value.minPrice?.toString() ?? "",
    maxPrice: parsed.value.maxPrice?.toString() ?? "",
    available: parsed.value.available,
  }));
  function apply(filters: FilterValues) {
    return router.push({
      query: {
        ...route.query,
        page: undefined,
        brand: undefined,
        minPrice: filters.minPrice || undefined,
        maxPrice: filters.maxPrice || undefined,
        available: filters.available ? "1" : undefined,
        material: undefined,
      },
    });
  }
  function reset() {
    return apply({
      minPrice: "",
      maxPrice: "",
      available: false,
    });
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
  return { parsed, requestQuery, values, apply, reset, sort };
}

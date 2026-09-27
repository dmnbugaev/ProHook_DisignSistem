import type { CatalogMeta } from "~~/shared/types/catalog";
export function useStoreSelection() {
  const storeId = useCookie<string | null>("prohook-store", {
    default: () => null,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  const pickerOpen = useState("store-picker-open", () => false);
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
    pickerOpen.value = false;
  }
  return { storeId, store, city, pickerOpen, select };
}

<script setup lang="ts">
import { formatPrice } from "~~/shared/utils/product";

interface SuggestItem {
  id: string;
  slug: string;
  name: string;
  categoryName: string;
  price: number | null;
}

const props = defineProps<{
  initial?: string;
  compact?: boolean;
  autofocus?: boolean;
}>();
const query = ref(props.initial ?? "");
watch(
  () => props.initial,
  (value) => {
    query.value = value ?? "";
  },
);
const { store } = useStoreSelection();
const items = ref<SuggestItem[]>([]);
const open = ref(false);
const highlight = ref(-1);
const listId = useId();
const root = ref<HTMLDivElement>();
let timer: ReturnType<typeof setTimeout> | undefined;
let sequence = 0;

function hide() {
  open.value = false;
  highlight.value = -1;
}
// Подсказки грузятся с дебаунсом; ответы приходят не по порядку —
// защищаемся номером запроса, чтобы не мигали устаревшие списки.
function request() {
  if (timer) clearTimeout(timer);
  const q = query.value.trim();
  if (q.length < 2) {
    sequence++;
    items.value = [];
    hide();
    return;
  }
  timer = setTimeout(async () => {
    const current = ++sequence;
    try {
      const response = await $fetch<{ items: SuggestItem[] }>(
        "/api/products/suggest",
        {
          query: { q, ...(store.value ? { storeId: store.value.id } : {}) },
          retry: 0,
        },
      );
      if (current !== sequence) return;
      items.value = response.items;
      highlight.value = -1;
      open.value = response.items.length > 0;
    } catch {
      if (current === sequence) hide();
    }
  }, 180);
}
function move(delta: number) {
  if (!items.value.length) return;
  // Позиции: -1 (ничего не выбрано, Enter — обычный поиск) и 0..N-1.
  const size = items.value.length + 1;
  highlight.value = ((highlight.value + 1 + delta + size) % size) - 1;
}
function choose(item: SuggestItem) {
  hide();
  void navigateTo(`/product/${item.slug}`);
}
function submit() {
  hide();
  return navigateTo({
    path: "/search",
    query: query.value.trim() ? { q: query.value.trim() } : {},
  });
}
function onFocus() {
  if (items.value.length) open.value = true;
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (!open.value && items.value.length) open.value = true;
    else move(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    move(-1);
  } else if (event.key === "Enter") {
    const item = items.value[highlight.value];
    if (open.value && item) {
      event.preventDefault();
      choose(item);
    }
  } else if (event.key === "Escape" && open.value) {
    event.preventDefault();
    hide();
  }
}
function onPointerDown(event: PointerEvent) {
  if (root.value && !root.value.contains(event.target as Node)) hide();
}
onMounted(() => document.addEventListener("pointerdown", onPointerDown, true));
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onPointerDown, true);
  if (timer) clearTimeout(timer);
});
</script>
<template>
  <div
    ref="root"
    class="search-form"
    :class="{ 'search-form--compact': compact }"
  >
    <form role="search" @submit.prevent="submit">
      <UiField
        v-model="query"
        label="Поиск по каталогу"
        type="search"
        placeholder="Название или артикул"
        maxlength="200"
        :autofocus="autofocus || undefined"
        role="combobox"
        :aria-expanded="open"
        :aria-controls="listId"
        aria-autocomplete="list"
        :aria-activedescendant="
          open && highlight >= 0 ? `${listId}-${highlight}` : undefined
        "
        autocomplete="off"
        @input="request"
        @focus="onFocus"
        @keydown="onKeydown"
      />
      <UiButton type="submit" variant="secondary">Найти</UiButton>
    </form>
    <ul
      v-if="open && items.length"
      :id="listId"
      class="search-suggest"
      role="listbox"
      aria-label="Подсказки поиска"
    >
      <li
        v-for="(item, index) in items"
        :id="`${listId}-${index}`"
        :key="item.id"
        role="option"
        :aria-selected="index === highlight"
      >
        <button type="button" @click="choose(item)">
          <span class="search-suggest__name">{{ item.name }}</span>
          <span class="search-suggest__meta caption">
            {{ item.categoryName
            }}<template v-if="item.price !== null"
              >· {{ formatPrice(item.price) }}</template
            >
          </span>
        </button>
      </li>
      <li class="search-suggest__footer caption" aria-hidden="true">
        ↑↓ — выбор · Enter — искать по каталогу
      </li>
    </ul>
  </div>
</template>

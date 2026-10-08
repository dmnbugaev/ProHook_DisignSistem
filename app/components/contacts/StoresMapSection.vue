<script setup lang="ts">
import type { StoreLocation } from "~~/shared/types/store";
import { storeCities, storeLocations } from "~~/shared/content/stores";

const selectedId = ref<string | null>(null);

const storesByCity = (cityId: string) =>
  storeLocations.filter((store) => store.cityId === cityId);

const storeCountLabel = (count: number) => {
  const last = count % 10;
  const tens = count % 100;
  let word = "магазинов";
  if (last === 1 && tens !== 11) {
    word = "магазин";
  } else if (last >= 2 && last <= 4 && (tens < 12 || tens > 14)) {
    word = "магазина";
  }
  return `${count} ${word}`;
};

const optionCaption = (store: StoreLocation) => {
  const city = storeCities.find((item) => item.id === store.cityId);
  if (store.name === store.address) {
    return city?.name ?? null;
  }
  return [city?.name, store.address].filter(Boolean).join(", ");
};

const toggleSelection = (id: string) => {
  selectedId.value = selectedId.value === id ? null : id;
};

// Клик по маркеру всегда выбирает точку: повторный клик по пину
// не должен закрывать попап.
const selectFromMap = (id: string) => {
  selectedId.value = id;
};
</script>

<template>
  <section class="stores-map-section" aria-labelledby="stores-map-heading">
    <div class="stores-map-intro">
      <h2 id="stores-map-heading">Наши магазины</h2>
      <p class="caption">Выберите ближайший магазин</p>
    </div>
    <div class="stores-map-layout">
      <div class="stores-map-frame">
        <StoreMapCanvas
          :stores="[...storeLocations]"
          :selected-id="selectedId"
          @select="selectFromMap"
        />
      </div>
      <aside class="stores-map-list" aria-label="Список магазинов сети">
        <section
          v-for="city in storeCities"
          :key="city.id"
          class="stores-map-city"
        >
          <h3>
            {{ city.name }}
            <span class="caption">{{
              storeCountLabel(storesByCity(city.id).length)
            }}</span>
          </h3>
          <ul>
            <li v-for="store in storesByCity(city.id)" :key="store.id">
              <button
                type="button"
                class="store-map-option"
                :class="{
                  'store-map-option--selected': selectedId === store.id,
                }"
                :aria-pressed="selectedId === store.id"
                @click="toggleSelection(store.id)"
              >
                <strong>{{ store.name }}</strong>
                <span class="caption">{{ optionCaption(store) }}</span>
              </button>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </section>
</template>

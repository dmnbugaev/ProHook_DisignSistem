<script setup lang="ts">
import type { ProductImage } from "~~/shared/types/product";

const props = defineProps<{
  slug: string;
  images: ProductImage[];
  /** Сервер скрыл изображения: нет подтверждённого 18+. */
  restricted?: boolean;
}>();

/** Листание — только при нескольких доступных фото. */
const scrollable = computed(() => !props.restricted && props.images.length > 1);

const track = ref<HTMLElement | null>(null);
const active = ref(0);

function onScroll() {
  const el = track.value;
  const slide = el?.firstElementChild;
  if (!el || !(slide instanceof HTMLElement) || slide.offsetWidth === 0) return;
  active.value = Math.max(
    0,
    Math.min(
      props.images.length - 1,
      Math.round(el.scrollLeft / slide.offsetWidth),
    ),
  );
}

function step(direction: 1 | -1) {
  const el = track.value;
  if (!el) return;
  const target = Math.max(
    0,
    Math.min(props.images.length - 1, active.value + direction),
  );
  el.scrollTo({
    left: target * el.clientWidth,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
}
</script>

<template>
  <NuxtLink
    v-if="!scrollable"
    :to="`/product/${slug}`"
    class="card-slider__link"
    tabindex="-1"
    aria-hidden="true"
  >
    <ProductImage :image="images[0]" :restricted="restricted" />
  </NuxtLink>
  <div v-else class="card-slider">
    <NuxtLink
      :to="`/product/${slug}`"
      class="card-slider__link"
      tabindex="-1"
      aria-hidden="true"
    >
      <div ref="track" class="card-slider__track" @scroll="onScroll">
        <div v-for="image in images" :key="image.id" class="card-slider__slide">
          <ProductImage :image="image" />
        </div>
      </div>
    </NuxtLink>
    <button
      type="button"
      class="icon-button card-slider__arrow card-slider__arrow--prev"
      aria-label="Предыдущее фото товара"
      @click="step(-1)"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M19 12H5m0 0 6-6m-6 6 6 6"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <button
      type="button"
      class="icon-button card-slider__arrow card-slider__arrow--next"
      aria-label="Следующее фото товара"
      @click="step(1)"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M5 12h14m0 0-6-6m6 6-6 6"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <div class="card-slider__dots" aria-hidden="true">
      <span
        v-for="(image, index) in images"
        :key="image.id"
        class="card-slider__dot"
        :class="{ 'card-slider__dot--active': index === active }"
      ></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PromoCard } from "~~/shared/types/promo";

/**
 * Блок «Акции и предложения» (взамен секции MOK): карточки наполняются
 * владельцем через Telegram-бота акций. Показывается после подтверждения
 * 18+ (v-if в index.vue) и только при непустом списке.
 *
 * Карусель: горизонтальная лента со scroll-snap, сфокусированная карточка
 * крупнее; автопрокрутка каждые 10 секунд; внизу пейджер — стрелки,
 * центрированный индикатор-полосы и счётчик «01 / 03». Лента бесшовная:
 * в DOM три копии списка, крайняя копия — только для перехода через край;
 * когда прокрутка успокаивается на крайней копии, позиция мгновенно (без
 * анимации) переносится на ту же карточку средней копии — конец ленты
 * незаметно склеен с началом. Боковые карточки «испаряются» маской-градиентом
 * по краям ленты. Пауза при наведении, фокусе, касании и скрытой вкладке;
 * prefers-reduced-motion — без автопрокрутки.
 */
const { data } = await useFetch<{ items: PromoCard[] }>("/api/promos");
const items = computed(() => data.value?.items ?? []);

/** Дом-лента: три копии карточек — средняя рабочая, крайние для цикла. */
const slides = computed(() => {
  const list = items.value;
  // Копии идут цельными группами: [весь список] × 3 — порядок DOM
  // совпадает с индексами, от которых считает позиции прокрутка.
  return [0, 1, 2].flatMap((copy) =>
    list.map((promo, index) => ({
      key: `${copy}-${promo.id}`,
      promo,
      index: copy * list.length + index,
    })),
  );
});

const CARD_MS = 10_000;
const SETTLE_MS = 160;
const track = ref<HTMLElement | null>(null);
/** Индекс в slides (0…3N−1); начальная позиция — первая карточка средней копии. */
const active = ref(0);
const paused = ref(false);
const progress = ref(0);
let startedAt = 0;
let elapsed = 0;
let frame = 0;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
let reducedMotion = false;

/** Логический номер карточки (0…N−1) — для индикатора и счётчика. */
const logicalActive = computed(() => {
  const total = items.value.length;
  return total ? ((active.value % total) + total) % total : 0;
});

const isInternal = (href: string) => href.startsWith("/");
const counterCurrent = computed(() =>
  String(logicalActive.value + 1).padStart(2, "0"),
);
const counterTotal = computed(() =>
  String(items.value.length).padStart(2, "0"),
);

function cardAt(index: number): HTMLElement | null {
  const element = track.value?.children[index] as HTMLElement | undefined;
  return element ?? null;
}

function scrollToCard(index: number, instant = false) {
  const card = cardAt(index);
  const list = track.value;
  if (!card || !list) return;
  list.scrollTo({
    left: card.offsetLeft - (list.clientWidth - card.offsetWidth) / 2,
    behavior: instant || reducedMotion ? "instant" : "smooth",
  });
}

/** Сброс таймера заполнения полосы (смена карточки, ручной скролл). */
function restartProgress() {
  elapsed = 0;
  startedAt = performance.now();
  progress.value = 0;
}

/**
 * Переход к логическому номеру: шаг считается от текущей позиции в ленте,
 * чтобы движение через край (последняя → первая) шло вперёд без рывка —
 * срабатывает копия соседней секции, а склейка обратно в среднюю копию
 * происходит после остановки прокрутки (see scheduleSettle).
 */
function go(index: number) {
  const total = items.value.length;
  if (!total) return;
  const step = (((index - logicalActive.value) % total) + total) % total;
  if (!step) return;
  active.value += step;
  scrollToCard(active.value);
  restartProgress();
}

const next = () => go(logicalActive.value + 1);
const prev = () => go(logicalActive.value - 1);

function tick(now: number) {
  frame = requestAnimationFrame(tick);
  if (paused.value || reducedMotion || items.value.length < 2) return;
  const value = (elapsed + (now - startedAt)) / CARD_MS;
  if (value >= 1) {
    next();
    return;
  }
  progress.value = value;
}

function pause() {
  if (paused.value) return;
  paused.value = true;
  elapsed += performance.now() - startedAt;
}

function resume() {
  if (!paused.value) return;
  paused.value = false;
  startedAt = performance.now();
}

/**
 * Пауза на касании: pointerup может прийти за пределами секции (свайп с
 * уводом пальца) — тогда событие сюда не всплывёт, и карусель зависнет
 * на паузе. Страхуемся однократным слушателем на window.
 */
function pauseForPointer() {
  pause();
  window.addEventListener("pointerup", resume, { once: true });
}

function onVisibilityChange() {
  if (document.hidden) pause();
  else resume();
}

/** Активная карточка — ближайшая к центру ленты (ручной скролл/свайп). */
let scrollSync = 0;
function onScroll() {
  if (scrollSync) return;
  scrollSync = requestAnimationFrame(() => {
    scrollSync = 0;
    const list = track.value;
    if (!list) return;
    const center = list.scrollLeft + list.clientWidth / 2;
    let best = active.value;
    let bestDistance = Infinity;
    for (let index = 0; index < list.children.length; index++) {
      const card = list.children[index] as HTMLElement;
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(cardCenter - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
    if (best !== active.value) {
      active.value = best;
      restartProgress();
    }
    scheduleSettle();
  });
}

/**
 * Склейка цикла: когда прокрутка успокоилась на крайней копии, переносим
 * позицию на ту же карточку средней копии без анимации — визуально ничего
 * не меняется, но запас для следующего перехода через край восстановлен.
 */
function scheduleSettle() {
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    const total = items.value.length;
    if (!total) return;
    if (active.value >= total && active.value < total * 2) return;
    active.value += active.value < total ? total : -total;
    scrollToCard(active.value, true);
  }, SETTLE_MS);
}

onMounted(() => {
  reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const total = items.value.length;
  if (total) {
    active.value = total;
    scrollToCard(total, true);
  }
  restartProgress();
  frame = requestAnimationFrame(tick);
  track.value?.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  if (scrollSync) cancelAnimationFrame(scrollSync);
  clearTimeout(settleTimer);
  track.value?.removeEventListener("scroll", onScroll);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("pointerup", resume);
});
</script>
<template>
  <section
    v-if="items.length"
    class="promos section"
    aria-labelledby="promos-title"
    @mouseenter="pause"
    @mouseleave="resume"
    @focusin="pause"
    @focusout="resume"
    @pointerdown="pauseForPointer"
    @pointerup="resume"
    @pointercancel="resume"
  >
    <UiContainer>
      <div class="section-heading" data-reveal>
        <div>
          <p class="eyebrow">ПроХук / Акции</p>
          <h2 id="promos-title">Акции и предложения.</h2>
        </div>
        <p class="caption promos__hint">
          Меняются сами каждые 10 секунд — или листайте стрелками.
        </p>
      </div>
      <div class="promos__viewport" data-reveal style="--reveal-step: 1">
        <div
          ref="track"
          class="promos__track"
          tabindex="0"
          role="region"
          aria-label="Карточки акций, горизонтальная прокрутка"
          @keydown.left.prevent="prev"
          @keydown.right.prevent="next"
        >
          <article
            v-for="slide in slides"
            :key="slide.key"
            class="promo-card"
            :class="[
              `promo-card--${slide.promo.accent}`,
              { 'promo-card--active': slide.index === active },
            ]"
          >
            <img
              v-if="slide.promo.image"
              class="promo-card__image"
              :src="slide.promo.image"
              alt=""
              loading="lazy"
              decoding="async"
            />
            <div class="promo-card__body">
              <span v-if="slide.promo.badge" class="promo-card__badge">{{
                slide.promo.badge
              }}</span>
              <h3>{{ slide.promo.title }}</h3>
              <p v-if="slide.promo.text">{{ slide.promo.text }}</p>
              <NuxtLink
                v-if="slide.promo.ctaHref && isInternal(slide.promo.ctaHref)"
                :to="slide.promo.ctaHref"
                class="promo-card__cta"
                >{{ slide.promo.ctaLabel ?? "Открыть" }}
                <span aria-hidden="true">↗</span></NuxtLink
              >
              <a
                v-else-if="slide.promo.ctaHref"
                :href="slide.promo.ctaHref"
                rel="noopener"
                class="promo-card__cta"
                >{{ slide.promo.ctaLabel ?? "Открыть" }}
                <span aria-hidden="true">↗</span></a
              >
            </div>
          </article>
        </div>
        <div class="promos__controls">
          <button
            type="button"
            class="icon-button promos__arrow"
            aria-label="Предыдущая карточка"
            @click="prev"
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
            class="icon-button promos__arrow"
            aria-label="Следующая карточка"
            @click="next"
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
          <div
            class="promos__progress"
            role="tablist"
            aria-label="Индикатор карточек акций"
          >
            <button
              v-for="(promo, index) in items"
              :key="promo.id"
              type="button"
              class="promos__segment"
              role="tab"
              :aria-selected="index === logicalActive"
              :aria-label="`Карточка ${index + 1}: ${promo.title}`"
              @click="go(index)"
            >
              <span
                class="promos__fill"
                :style="{
                  transform: `scaleX(${
                    index < logicalActive
                      ? 1
                      : index === logicalActive
                        ? progress
                        : 0
                  })`,
                }"
              />
            </button>
          </div>
          <p class="promos__counter" aria-hidden="true">
            <span class="promos__counter-current">{{ counterCurrent }}</span>
            <span class="promos__counter-total">/ {{ counterTotal }}</span>
          </p>
        </div>
      </div>
    </UiContainer>
  </section>
</template>

<style scoped>
.promos {
  background: var(--ink);
  color: var(--background);
  /* Светлая полоса между витриной «Новинок» и чёрной плашкой: без неё край
     плашки прилипает к карточкам — прежний отступ был только внутри чёрного
     фона и зрительно секции стояли вплотную. */
  margin-top: var(--section-space);
  /* Отступ сверху больше стандартного ритма секций: чёрная полоса не
     прижимается к витрине «Новинок» над ней. */
  padding-top: calc(var(--section-space) + 64px);
  /* .section задаёт только верхний отступ — уравниваем низ, чтобы чёрная
     полоса дышала симметрично. */
  padding-bottom: var(--section-space);
}
.promos .eyebrow {
  color: var(--accent);
}
.promos__hint {
  color: #929292;
}
.promos__track {
  --promo-fade: 140px;
  display: flex;
  gap: var(--space-6);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  /* Центрирование снапа: карточка шириной контента, поля с боков — не меньше
     гуттера. Проценты в flex-basis считались бы от контент-бокса (зависит от
     этих же полей) — поэтому ширина задана константой, а не переменной. */
  padding-inline: max(var(--gutter), calc((100% - 920px) / 2));
  padding-block: var(--space-2);
  scrollbar-width: none;
  outline: none;
  /* Боковые карточки не обрезаются жёстко, а мягко растворяются к краю:
     у самого края остаётся 30% видимости — карточки читаются, а не гаснут. */
  mask-image: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.3) 0,
    #000 var(--promo-fade),
    #000 calc(100% - var(--promo-fade)),
    rgba(0, 0, 0, 0.3) 100%
  );
  -webkit-mask-image: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.3) 0,
    #000 var(--promo-fade),
    #000 calc(100% - var(--promo-fade)),
    rgba(0, 0, 0, 0.3) 100%
  );
}
.promos__track::-webkit-scrollbar {
  display: none;
}
.promos__track:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}
.promo-card {
  /* Широкая карточка под портретное фото: 45% от 920px = 414×552 — фото
     остаётся героем карточки, а текст получает полноценную колонку.
     Константа 920px продублирована в padding-inline ленты (см. ниже). */
  flex: 0 0 min(920px, 100%);
  scroll-snap-align: center;
  /* Фото — вертикальное 3:4, рядом с ним текст (на мобиле — фото сверху);
     полноразмерный портрет над текстом сделал бы карточку 900+ px высотой. */
  display: flex;
  flex-direction: row;
  border-radius: var(--radius-card);
  overflow: hidden;
  /* Соседние карточки заметно меньше сфокусированной — акцент внимания. */
  transform: scale(0.87);
  opacity: 0.4;
  transition:
    transform var(--duration-panel) ease,
    opacity var(--duration-panel) ease;
}
.promo-card--active {
  transform: scale(1);
  opacity: 1;
}
.promo-card--yellow {
  background: var(--accent);
  color: var(--ink);
}
.promo-card--ink {
  background: #141414;
  color: var(--background);
  border: 1px solid rgba(255, 255, 255, 0.16);
}
.promo-card__image {
  /* Портретная рамка 3:4 (снимки из Telegram чаще вертикальные): ширина
     фиксирована долей карточки, высота — из соотношения; если текст длиннее,
     карточка растёт и фото дорезается cover-ом без искажения. min-width: 0
     обязателен: у <img> автоматический flex-минимум равен внутренней ширине
     снимка (1000+ px) и после загрузки растягивает фото на всю карточку. */
  flex: 0 0 45%;
  min-width: 0;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  display: block;
}
.promo-card__body {
  display: grid;
  gap: 14px;
  align-content: start;
  padding: clamp(20px, 3vw, 32px);
  flex: 1;
}
.promo-card__badge {
  justify-self: start;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: var(--weight-extrabold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.promo-card--yellow .promo-card__badge {
  background: var(--ink);
  color: var(--accent);
}
.promo-card--ink .promo-card__badge {
  background: var(--accent);
  color: var(--ink);
}
.promo-card h3 {
  font-size: clamp(26px, 2.8vw, 40px);
  font-weight: var(--weight-extrabold);
  letter-spacing: -0.02em;
  line-height: 1.1;
}
.promo-card p {
  font-size: 15px;
  line-height: 1.55;
  max-width: 46ch;
}
.promo-card--yellow p {
  color: rgba(0, 0, 0, 0.74);
}
.promo-card--ink p {
  color: #b3b3b3;
}
.promo-card__cta {
  /* Кнопка прижата к низу карточки — ровная линия на карточках разной
     высоты (фото удлиняет карточку). */
  margin-top: auto;
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
  padding: var(--space-2) var(--space-4);
  border: 1px solid currentColor;
  border-radius: var(--radius-control);
  text-decoration: none;
  font-weight: var(--weight-bold);
  font-size: 15px;
  transition:
    box-shadow var(--duration-fast) ease,
    transform var(--duration-fast) ease;
}
.promo-card__cta:hover,
.promo-card__cta:focus-visible {
  box-shadow: 3px 3px 0 currentColor;
  transform: translate(-1px, -1px);
}
.promos__controls {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-top: var(--space-6);
}
/* Стрелки максимально тихие: только SVG-стрелка, без рамок и заливок; при
   наведении — жёлтая плашка с чёрной стрелкой (язык кнопок сайта).
   Стрелка — именно SVG, не текстовый глиф: путь симметричен viewBox, и сетка
   .icon-button центрирует её в квадрате пиксельно (глифы «←»/«→» сидят
   в строке асимметрично). */
.promos__arrow {
  border: 1px solid transparent;
  color: rgba(255, 255, 255, 0.5);
  flex: 0 0 auto;
  transition:
    color var(--duration-fast) ease,
    background-color var(--duration-fast) ease,
    border-color var(--duration-fast) ease;
}
.promos__arrow:hover,
.promos__arrow:focus-visible {
  background: var(--accent);
  border-color: var(--ink);
  color: var(--ink);
}
.promos__arrow:focus-visible {
  outline-color: var(--accent);
}
/* Индикатор — точно по центру ленты, независимо от ширины стрелок
   и счётчика по краям. */
.promos__progress {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: min(320px, calc(100% - 260px));
  display: flex;
  gap: 6px;
}
.promos__segment {
  flex: 1;
  height: 6px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.2);
  overflow: hidden;
  cursor: pointer;
  /* Тач-цель расширяется прозрачной областью вокруг полосы. */
  position: relative;
}
.promos__segment::before {
  content: "";
  position: absolute;
  inset: -19px 0;
}
.promos__segment:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.promos__fill {
  position: absolute;
  inset: 0;
  background: var(--accent);
  transform-origin: left center;
  transform: scaleX(0);
}
.promos__counter {
  margin-left: auto;
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-size: 15px;
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}
.promos__counter-total {
  color: #929292;
}
@media (max-width: 767px) {
  .promos__track {
    --promo-fade: 32px;
    gap: var(--space-4);
  }
  /* Узкий экран: фото на всю ширину карточки, текст под ним. */
  .promo-card {
    flex-direction: column;
  }
  .promo-card__image {
    flex-basis: auto;
    width: 100%;
  }
  .promo-card h3 {
    font-size: 22px;
  }
  .promos__controls {
    margin-top: var(--space-4);
  }
  /* На узких экранах центрировать индикатор некуда — он в потоке
     между стрелками и счётчиком. */
  .promos__progress {
    position: static;
    transform: none;
    width: auto;
    flex: 1 1 auto;
  }
}
@media (prefers-reduced-motion: reduce) {
  .promos__track {
    scroll-behavior: auto;
  }
  .promo-card {
    transition: none;
  }
}
</style>

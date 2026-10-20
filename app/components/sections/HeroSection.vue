<script setup lang="ts">
/**
 * Кинетический герой: построчное появление заголовка, бегущая строка-
 * маркиза, статистика сети со счётчиками, лёгкий параллакс слоёв при
 * прокрутке и наклон плиты за курсором. Знак справа — «прорыв»:
 * талисман (HeroMascot, персонаж по эскизу владельца) с разгоном
 * ломится сквозь серую стену — плита дрожит, расходится трещинами
 * от точки удара и разлетается осколками с ударной волной, под ней
 * жёлтое ядро, из пролома ударом вышибает знак ПроХука; талисман
 * вскидывает руку-«победу», глаза радуются. Всё — CSS/SVG без
 * зависимостей; при prefers-reduced-motion показывается статичная
 * финальная композиция (глобальный kill-switch в main.css).
 */
const props = defineProps<{
  storesCount?: number;
  productsTotal?: number;
  citiesCount?: number;
}>();
const artField = ref<HTMLElement | null>(null);

const stats = computed(() =>
  [
    props.storesCount && props.storesCount > 0
      ? { value: props.storesCount, label: "магазинов сети" }
      : null,
    props.productsTotal && props.productsTotal > 0
      ? { value: props.productsTotal, suffix: "+", label: "позиций в каталоге" }
      : null,
    props.citiesCount && props.citiesCount > 0
      ? { value: props.citiesCount, label: "города присутствия" }
      : null,
  ].filter((item): item is { value: number; suffix?: string; label: string } =>
    Boolean(item),
  ),
);

const formatValue = (value: number) =>
  new Intl.NumberFormat("ru-RU").format(value);

/** Счётчик: анимация от 0 до значения при появлении в кадре. */
function animateCounters(section: HTMLElement) {
  const elements = section.querySelectorAll<HTMLElement>("[data-count]");
  if (!elements?.length) return;
  const animate = (element: HTMLElement) => {
    const target = Number(element.dataset.count ?? "0");
    const suffix = element.dataset.suffix ?? "";
    const startedAt = performance.now();
    const duration = 1100;
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      // easeOutCubic — быстрый разгон, мягкое торможение.
      const eased = 1 - (1 - progress) ** 3;
      element.textContent = `${formatValue(Math.round(target * eased))}${suffix}`;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          animate(entry.target as HTMLElement);
        }
    },
    { threshold: 0.4 },
  );
  for (const element of elements) observer.observe(element);
}

/** Параллакс: прогресс ухода героя из кадра → CSS-переменная на секции. */
function attachParallax(section: HTMLElement) {
  let frame = 0;
  const onScroll = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      // 0 — герой целиком в кадре, 1 — полностью ушёл вверх.
      const progress = Math.min(1, Math.max(0, -rect.top / rect.height));
      section.style.setProperty("--hero-parallax", progress.toFixed(3));
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/** Наклон знака за курсором: только точные указатели, живые 6°. */
function attachTilt(section: HTMLElement) {
  const field = artField.value;
  if (!window.matchMedia("(pointer: fine)").matches || !field) return;
  const onMove = (event: PointerEvent) => {
    const rect = field.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    field.style.setProperty("--tilt-x", `${(-y * 6).toFixed(2)}deg`);
    field.style.setProperty("--tilt-y", `${(x * 6).toFixed(2)}deg`);
  };
  const reset = () => {
    field.style.setProperty("--tilt-x", "0deg");
    field.style.setProperty("--tilt-y", "0deg");
  };
  section.addEventListener("pointermove", onMove);
  section.addEventListener("pointerleave", reset);
}

/** Первый экран: герой занимает окно ровно до нижней кромки. Высота =
    окно минус фактический отступ до героя — над ним юридическая плашка
    (закрывается без ресайза) и шапка, поэтому пересчитываем на resize и
    через ResizeObserver по телу документа. */
function attachScreenHeight(section: HTMLElement) {
  const apply = () => {
    const top = section.getBoundingClientRect().top + window.scrollY;
    section.style.setProperty(
      "--hero-min",
      `${Math.round(window.innerHeight - top)}px`,
    );
  };
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      apply();
    });
  };
  apply();
  window.addEventListener("resize", schedule);
  new ResizeObserver(schedule).observe(document.body);
}

onMounted(() => {
  // Template ref на UiContainer отдал бы instance компонента, а не элемент —
  // секция одна на странице, берём её из DOM.
  const section = document.querySelector<HTMLElement>("section.hero");
  if (!section) return;
  // Высота первого экрана — раскладка, не движение: ставится и при
  // prefers-reduced-motion.
  attachScreenHeight(section);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;
  animateCounters(section);
  attachParallax(section);
  attachTilt(section);
});
</script>
<template>
  <UiContainer
    as="section"
    class="hero hero--kinetic hero--screen"
    aria-labelledby="hero-title"
  >
    <div class="hero__copy">
      <p class="edition"><span class="edition__dot" />ПроХук / Каталог сети</p>
      <h1 id="hero-title">
        <span class="hero__line"
          ><span class="hero__line-inner">ПроХук.</span></span
        >
        <span class="hero__line"
          ><span class="hero__line-inner">Больше, чем</span></span
        >
        <span class="hero__line"
          ><span class="hero__line-inner">вейпшоп.</span></span
        >
      </h1>
      <p class="hero__intro">
        Информационный каталог товаров.<br />Выберите магазин, чтобы посмотреть
        ассортимент и наличие.
      </p>
      <NuxtLink to="/catalog" class="button button--primary button--large"
        >Открыть каталог <span aria-hidden="true">↗</span></NuxtLink
      >
    </div>
    <div class="hero__art">
      <div ref="artField" class="hero__art-field">
        <!-- Ядро: жёлтая плита со знаком — то, что скрыто за стеной. -->
        <div class="hero__core">
          <div class="hero__mark-wrap">
            <img
              class="hero__mark"
              src="/brand/mark-large.webp"
              alt="Фирменный знак ПроХук"
              width="720"
              height="720"
              fetchpriority="high"
            />
          </div>
        </div>
        <!-- Талисман стоит за стеной (z-index ниже) и прорывает её насквозь. -->
        <HeroMascot class="hero__mascot" />
        <!-- Стена: четыре осколка тем же серым, что плита (до прорыва —
             ровная поверхность); разлетаются наружу от точки удара. -->
        <div class="hero__wall" aria-hidden="true">
          <span class="hero__shard hero__shard--n" />
          <span class="hero__shard hero__shard--e" />
          <span class="hero__shard hero__shard--s" />
          <span class="hero__shard hero__shard--w" />
        </div>
        <!-- Трещины: расходятся от точки прорыва (24,78 — центр талисмана)
             в последний момент перед разлётом осколков. -->
        <svg
          class="hero__cracks"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            class="hero__crack hero__crack--1"
            d="M24 78L34 66L30 54L42 42L40 28"
            pathLength="1"
          />
          <path
            class="hero__crack hero__crack--2"
            d="M24 78L14 64L20 52L12 38"
            pathLength="1"
          />
          <path
            class="hero__crack hero__crack--3"
            d="M24 78L44 80L58 72L72 76L88 66"
            pathLength="1"
          />
          <path
            class="hero__crack hero__crack--4"
            d="M24 78L10 88L4 98"
            pathLength="1"
          />
          <path
            class="hero__crack hero__crack--5"
            d="M24 78L26 60L22 44L30 28"
            pathLength="1"
          />
        </svg>
        <!-- Ударная волна и щепки в момент прорыва. -->
        <span class="hero__shock hero__shock--a" aria-hidden="true" />
        <span class="hero__shock hero__shock--b" aria-hidden="true" />
        <div class="hero__chips" aria-hidden="true">
          <span class="hero__chip hero__chip--1" />
          <span class="hero__chip hero__chip--2" />
          <span class="hero__chip hero__chip--3" />
          <span class="hero__chip hero__chip--4" />
          <span class="hero__chip hero__chip--5" />
          <span class="hero__chip hero__chip--6" />
        </div>
      </div>
    </div>
    <div v-if="stats.length" class="hero__stats">
      <div v-for="item in stats" :key="item.label" class="hero__stat">
        <strong :data-count="item.value" :data-suffix="item.suffix ?? ''"
          >{{ formatValue(item.value) }}{{ item.suffix ?? "" }}</strong
        >
        <span>{{ item.label }}</span>
      </div>
    </div>
    <div class="hero__marquee" aria-hidden="true">
      <div class="hero__marquee-track">
        <span
          >Каталог <i>✳</i> Наличие <i>✳</i> Цены <i>✳</i> Магазины сети
          <i>✳</i> Каталог <i>✳</i> Наличие <i>✳</i> Цены <i>✳</i> Магазины сети
          <i>✳</i> </span
        ><span
          >Каталог <i>✳</i> Наличие <i>✳</i> Цены <i>✳</i> Магазины сети
          <i>✳</i> Каталог <i>✳</i> Наличие <i>✳</i> Цены <i>✳</i> Магазины сети
          <i>✳</i>
        </span>
      </div>
    </div>
  </UiContainer>
</template>

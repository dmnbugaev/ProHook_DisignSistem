<script setup lang="ts">
/** Первый экран главной: фирменная композиция, фото только взрослой сессии. */
const props = defineProps<{
  storesCount?: number;
  productsTotal?: number;
  citiesCount?: number;
}>();
const { canViewProductImages } = useSessionUser();

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
});
</script>
<template>
  <UiContainer
    as="section"
    class="hero hero--floating hero--screen"
    aria-labelledby="hero-title"
  >
    <HeroFloatingScene :show-products="canViewProductImages" />
    <div class="hero__copy">
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

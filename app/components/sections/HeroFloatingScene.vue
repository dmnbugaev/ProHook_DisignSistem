<script setup lang="ts">
/** Предметы из эскиза владельца. Координаты — доли ширины/высоты сцены от центра. */
const items = [
  {
    image: "device-red",
    size: [320, 600],
    x: 7,
    y: -29,
    width: 5,
    angle: -20,
    depth: 0.8,
  },
  {
    image: "pack-mint",
    size: [600, 542],
    x: 40,
    y: -38,
    width: 10,
    angle: 12,
    depth: 1.1,
  },
  {
    image: "stick-orange",
    size: [600, 405],
    x: 21,
    y: -44,
    width: 9,
    angle: -24,
    depth: 0.5,
  },
  {
    image: "device-violet",
    size: [104, 374],
    x: 2,
    y: 16,
    width: 3,
    angle: 17,
    depth: 0.55,
  },
  {
    image: "pack-yellow",
    size: [600, 393],
    x: 44,
    y: 6,
    width: 10,
    angle: -12,
    depth: 1.2,
  },
  {
    image: "stick-single",
    size: [93, 600],
    x: 39,
    y: 22,
    width: 1.5,
    angle: 31,
    depth: 0.45,
  },
  {
    image: "device-green",
    size: [320, 600],
    x: 10,
    y: 39,
    width: 4,
    angle: 25,
    depth: 1,
  },
  {
    image: "pack-coral",
    size: [600, 570],
    x: 25,
    y: 43,
    width: 9,
    angle: -13,
    depth: 0.8,
  },
  {
    image: "stick-close",
    size: [600, 448],
    x: 3,
    y: -8,
    width: 8,
    angle: 28,
    depth: 0.6,
  },
  {
    image: "device-amber",
    size: [320, 600],
    x: 46,
    y: 36,
    width: 4,
    angle: -26,
    depth: 0.7,
  },
  {
    image: "pack-teal",
    size: [600, 523],
    x: 2,
    y: -38,
    width: 8.5,
    angle: -17,
    depth: 0.55,
  },
] as const;

const scene = ref<HTMLElement | null>(null);
const reducedMotion = ref(false);
let motionQuery: MediaQueryList | undefined;
let hero: HTMLElement | null = null;

function syncMotion() {
  reducedMotion.value = motionQuery?.matches ?? false;
  if (reducedMotion.value) reset();
}

onMounted(() => {
  motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  syncMotion();
  motionQuery.addEventListener("change", syncMotion);
  hero = scene.value?.closest<HTMLElement>(".hero") ?? null;
  hero?.addEventListener("pointermove", move);
  hero?.addEventListener("pointerleave", reset);
});
onBeforeUnmount(() => {
  motionQuery?.removeEventListener("change", syncMotion);
  hero?.removeEventListener("pointermove", move);
  hero?.removeEventListener("pointerleave", reset);
});

function move(event: PointerEvent) {
  if (reducedMotion.value || event.pointerType === "touch") return;
  const element = scene.value;
  if (!element) return;
  const bounds = element.getBoundingClientRect();
  element.style.setProperty(
    "--pointer-x",
    `${(Math.max(-0.5, Math.min(0.5, (event.clientX - bounds.left) / bounds.width - 0.5)) * 24).toFixed(1)}px`,
  );
  element.style.setProperty(
    "--pointer-y",
    `${(Math.max(-0.5, Math.min(0.5, (event.clientY - bounds.top) / bounds.height - 0.5)) * 18).toFixed(1)}px`,
  );
}

function reset() {
  scene.value?.style.setProperty("--pointer-x", "0px");
  scene.value?.style.setProperty("--pointer-y", "0px");
}
</script>

<template>
  <div ref="scene" class="floating-scene">
    <div class="floating-scene__center">
      <img
        src="/brand/mark-large.webp"
        alt="Фирменный знак ПроХук"
        width="720"
        height="720"
        fetchpriority="high"
      />
    </div>
    <div
      v-for="(item, index) in items"
      :key="item.image"
      class="floating-scene__item"
      :style="{
        '--x': item.x,
        '--y': item.y,
        '--mobile-y': item.y - (item.image === 'device-red' ? 12 : 0),
        '--width': item.width,
        '--mobile-x': (item.x - 22) * 1.8,
        '--mobile-width': item.width * 1.9,
        '--mobile-entry-x': `${(item.x - 22) * 0.8}cqw`,
        '--mobile-entry-y': `${(item.y - (item.image === 'device-red' ? 12 : 0)) * 0.55}cqh`,
        '--angle': `${item.angle}deg`,
        '--entry-angle': item.angle > 0 ? '-48deg' : '48deg',
        '--depth': item.depth,
        '--delay': `${450 + index * 65}ms`,
        '--duration': `${7 + (index % 4) * 1.4}s`,
      }"
      aria-hidden="true"
    >
      <div class="floating-scene__parallax">
        <div class="floating-scene__drift">
          <img
            :src="`/hero/${item.image}.webp`"
            alt=""
            :width="item.size[0]"
            :height="item.size[1]"
            draggable="false"
            :loading="index < 6 ? 'eager' : 'lazy'"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.floating-scene {
  position: relative;
  width: 100%;
  pointer-events: none;
  container-type: size;
  --pointer-x: 0px;
  --pointer-y: 0px;
}

.floating-scene__center {
  position: absolute;
  left: 73%;
  top: 50%;
  width: 24cqw;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  background: var(--accent);
  translate: -50% -50%;
  animation:
    center-enter 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both,
    center-float 5.5s ease-in-out 900ms infinite alternate;
}

.floating-scene__center img {
  display: block;
  width: 100%;
  height: auto;
  animation: mark-enter 820ms cubic-bezier(0.18, 0.8, 0.2, 1) 180ms both;
}

.floating-scene__item {
  --final-x: var(--x);
  --final-y: var(--y);
  --item-width: var(--width);
  --burst-x: 23cqw;
  --burst-y: 0cqh;
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(var(--item-width) * 1cqw);
  z-index: 1;
  translate: calc(var(--final-x) * 1cqw - 50%) calc(var(--final-y) * 1cqh - 50%);
  animation: item-burst 1100ms cubic-bezier(0.2, 0.78, 0.24, 1) var(--delay)
    both;
}

.floating-scene__parallax {
  transform: translate(
    calc(var(--pointer-x) * var(--depth)),
    calc(var(--pointer-y) * var(--depth))
  );
  transition: transform 460ms cubic-bezier(0.2, 0.8, 0.25, 1);
}

.floating-scene__drift {
  animation: item-drift var(--duration) ease-in-out calc(var(--delay) + 1100ms)
    infinite alternate;
}

.floating-scene__item img {
  display: block;
  width: 100%;
  height: auto;
  transform: rotate(var(--angle));
  filter: drop-shadow(0 13px 13px rgb(0 0 0 / 0.17));
  user-select: none;
  -webkit-user-drag: none;
}

@keyframes center-enter {
  from {
    opacity: 0;
    scale: 0.76;
    rotate: -6deg;
  }
  72% {
    opacity: 1;
    scale: 1.035;
    rotate: 1deg;
  }
  to {
    opacity: 1;
    scale: 1;
    rotate: 0deg;
  }
}

@keyframes center-enter-mobile {
  from {
    opacity: 0;
    scale: 0.48;
    rotate: -17deg;
  }
  70% {
    opacity: 1;
    scale: 1.07;
    rotate: 3deg;
  }
  to {
    opacity: 1;
    scale: 1;
    rotate: 0deg;
  }
}

@keyframes center-float {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-6px);
  }
}

@keyframes mark-enter {
  from {
    opacity: 0;
    scale: 1.28;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}

@keyframes item-burst {
  from {
    translate: calc(var(--burst-x) - 50%) calc(var(--burst-y) - 50%);
    rotate: var(--entry-angle);
    scale: 0.16;
    opacity: 0;
  }
  54% {
    opacity: 1;
  }
  78% {
    scale: 1.08;
  }
  to {
    translate: calc(var(--final-x) * 1cqw - 50%)
      calc(var(--final-y) * 1cqh - 50%);
    rotate: 0deg;
    scale: 1;
    opacity: 1;
  }
}

@keyframes item-drift {
  from {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }
  to {
    transform: translate3d(5px, -8px, 0) rotate(3deg);
  }
}

@media (max-width: 767px) {
  .floating-scene__center {
    left: 50%;
    width: 53cqw;
    animation:
      center-enter-mobile 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both,
      center-float 5.5s ease-in-out 900ms infinite alternate;
  }

  .floating-scene__item {
    --final-x: var(--mobile-x);
    --final-y: var(--mobile-y);
    --item-width: var(--mobile-width);
    --burst-x: calc(var(--mobile-x) * 1cqw + var(--mobile-entry-x));
    --burst-y: calc(var(--mobile-y) * 1cqh + var(--mobile-entry-y));
  }

  .floating-scene__item:nth-last-child(2),
  .floating-scene__item:last-child {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .floating-scene__center,
  .floating-scene__item,
  .floating-scene__drift {
    animation: none;
  }

  .floating-scene__parallax {
    transition: none;
  }
}
</style>

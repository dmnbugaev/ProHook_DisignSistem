<script setup lang="ts">
const scene = ref<HTMLElement>();
const still = ref(false);
const reduced = ref(false);
let observer: IntersectionObserver | undefined;
let media: MediaQueryList | undefined;
let visible = false;
let frame = 0;
function paint() {
  frame = 0;
  if (!scene.value) return;
  if (still.value || reduced.value) {
    scene.value.style.setProperty("--remaining", "0");
    return;
  }
  const rect = scene.value.getBoundingClientRect();
  const progress = Math.min(
    1,
    Math.max(
      0,
      (window.innerHeight - rect.top) /
        (window.innerHeight * 0.75 + rect.height * 0.25),
    ),
  );
  scene.value.style.setProperty("--remaining", String(1 - progress));
}
function schedule() {
  if (visible && !frame) frame = requestAnimationFrame(paint);
}
function preference() {
  reduced.value = media?.matches ?? false;
  paint();
}
watch(still, paint);
onMounted(() => {
  if (!("IntersectionObserver" in window)) {
    still.value = true;
    return;
  }
  media = window.matchMedia("(prefers-reduced-motion: reduce)");
  preference();
  media.addEventListener("change", preference);
  observer = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    if (visible) schedule();
  });
  if (scene.value) observer.observe(scene.value);
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
});
onBeforeUnmount(() => {
  observer?.disconnect();
  media?.removeEventListener("change", preference);
  window.removeEventListener("scroll", schedule);
  window.removeEventListener("resize", schedule);
  cancelAnimationFrame(frame);
});
</script>
<template>
  <div class="motion-study">
    <div ref="scene" class="motion-scene" aria-hidden="true">
      <div class="motion-shape motion-shape--outline" />
      <div class="motion-shape motion-shape--black" />
      <div class="motion-shape motion-shape--yellow" />
      <span class="motion-scene__baseline" />
    </div>
    <div class="motion-controls">
      <label class="choice"
        ><input v-model="still" type="checkbox" :disabled="reduced" />Статичная
        композиция</label
      ><span class="caption">{{
        reduced
          ? "Уменьшение движения включено в системе"
          : "Движение следует за прокруткой"
      }}</span>
    </div>
  </div>
</template>

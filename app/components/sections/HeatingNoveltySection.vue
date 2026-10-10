<script setup lang="ts">
const { data: meta } = await useCatalogMeta();
// Ссылка на корневую категорию «Системы нагревания табака» (slug = id папки
// МойСклад); если категория недоступна — ведём в общий каталог.
const heatingCategorySlug = computed(() => {
  const match = meta.value?.categories.find(
    (item) =>
      !item.parentId &&
      item.name.trim().toLocaleLowerCase("ru") === "системы нагревания табака",
  );
  return match?.slug ?? "";
});
</script>
<template>
  <section class="heating-novelty section" aria-labelledby="heating-title">
    <UiContainer>
      <div class="section-heading">
        <div>
          <p class="eyebrow">Новинка · Системы нагревания табака</p>
          <h2 id="heating-title">MOK FWRD и MOK SENSIO</h2>
        </div>
        <NuxtLink
          :to="
            heatingCategorySlug ? `/catalog/${heatingCategorySlug}` : '/catalog'
          "
          class="text-link section-heading__link"
          >Каталог систем нагревания ↗</NuxtLink
        >
      </div>
      <div class="heating-novelty__grid">
        <article class="heating-card" aria-label="MOK FWRD — стики COO">
          <div class="heating-card__scene" aria-hidden="true">
            <div class="heating-stick heating-stick--1">COO</div>
            <div class="heating-stick heating-stick--2">COO</div>
            <div class="heating-stick heating-stick--3">COO</div>
            <div class="heating-device">
              <span class="heating-device__mark">MOK</span>
              <span class="heating-device__slot"></span>
              <span class="heating-device__name">FWRD</span>
            </div>
          </div>
          <h3>MOK FWRD</h3>
          <p class="caption">Система нагревания под стики COO</p>
        </article>
        <article class="heating-card" aria-label="MOK SENSIO — стики SENTIC">
          <div class="heating-card__scene" aria-hidden="true">
            <div class="heating-stick heating-stick--1">SENTIC</div>
            <div class="heating-stick heating-stick--2">SENTIC</div>
            <div class="heating-stick heating-stick--3">SENTIC</div>
            <div class="heating-device heating-device--sensio">
              <span class="heating-device__mark">MOK</span>
              <span class="heating-device__slot"></span>
              <span class="heating-device__name">SENSIO</span>
            </div>
          </div>
          <h3>MOK SENSIO</h3>
          <p class="caption">Система нагревания под стики SENTIC</p>
        </article>
      </div>
      <p class="caption heating-novelty__note">
        Модели совместимы только со «своими» стиками: FWRD — COO, SENSIO —
        SENTIC. Наличие и цены уточняйте в справочном каталоге; продажа — только
        в магазинах сети лицам старше 18 лет.
      </p>
    </UiContainer>
  </section>
</template>

<style scoped>
.heating-novelty {
  background: var(--ink);
  color: var(--background);
}
.heating-novelty :deep(.eyebrow) {
  color: var(--accent);
}
.heating-novelty__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-8);
  margin-top: var(--space-10);
}
.heating-card {
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: var(--radius-card);
  padding: clamp(20px, 3vw, 36px);
  display: grid;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
}
.heating-card h3 {
  font-size: 24px;
  letter-spacing: -0.02em;
}
.heating-card .caption {
  color: #b8b8b8;
}
.heating-card__scene {
  position: relative;
  height: 150px;
  margin-bottom: 16px;
  /* Точка «приёмника»: устройство справа, стики прилетают слева. */
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.heating-device {
  position: relative;
  width: 96px;
  height: 132px;
  border: 2px solid var(--background);
  border-radius: 18px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  justify-items: center;
  align-items: center;
  padding: 12px 0;
  background: rgba(255, 255, 255, 0.04);
  z-index: 1;
}
.heating-device__mark {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.14em;
}
.heating-device__slot {
  width: 34px;
  height: 5px;
  border-radius: 3px;
  background: var(--accent);
  box-shadow: 0 0 18px rgba(255, 254, 0, 0.35);
}
.heating-device--sensio .heating-device__slot {
  background: var(--background);
  box-shadow: 0 0 18px rgba(255, 255, 255, 0.35);
}
.heating-device__name {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: #b8b8b8;
}
.heating-stick {
  position: absolute;
  left: 0;
  top: 50%;
  width: 78px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 1px solid var(--background);
  border-radius: 11px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--ink);
  background: var(--accent);
  will-change: transform, opacity;
  animation: heating-stick-arrive 3.6s cubic-bezier(0.22, 0.61, 0.24, 1)
    infinite;
}
.heating-stick--2 {
  animation-delay: 1.2s;
}
.heating-stick--3 {
  animation-delay: 2.4s;
}
/* Стик выдвигается слева, «влетает» в слот устройства и растворяется. */
@keyframes heating-stick-arrive {
  0% {
    transform: translate(-120px, -50%) rotate(-6deg);
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  46% {
    transform: translate(0, -50%) rotate(0deg);
    opacity: 1;
  }
  62% {
    transform: translate(60px, -50%) rotate(2deg);
    opacity: 1;
  }
  74%,
  100% {
    transform: translate(150px, -50%) rotate(0deg) scale(0.9);
    opacity: 0;
  }
}
.heating-novelty__note {
  margin-top: var(--space-8);
  color: #929292;
  max-width: 72ch;
}
/* Движение — только декорация: при prefers-reduced-motion статики лежат
   рядом с устройством без анимации. */
@media (prefers-reduced-motion: reduce) {
  .heating-stick {
    animation: none;
    opacity: 1;
  }
  .heating-stick--1 {
    transform: translate(0, calc(-50% - 34px));
  }
  .heating-stick--2 {
    transform: translate(0, -50%);
  }
  .heating-stick--3 {
    transform: translate(0, calc(-50% + 34px));
  }
}
@media (max-width: 639px) {
  .heating-novelty__grid {
    grid-template-columns: 1fr;
  }
  .heating-card__scene {
    height: 130px;
  }
}
</style>

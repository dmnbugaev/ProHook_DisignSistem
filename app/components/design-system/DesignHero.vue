<template>
  <UiContainer as="section" class="hero" aria-labelledby="hero-title">
    <div class="hero__copy">
      <p class="edition">
        <span class="edition__dot" />Прохук / Визуальная система
      </p>
      <h1 id="hero-title">
        Характер.<br />
        В каждой<br />
        детали.
      </h1>
      <p class="hero__intro">
        Форма, типографика и движение.<br />
        Единый язык для цифровой среды.
      </p>
      <a href="#components" class="button button--primary button--large"
        >Изучить компоненты
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M10 3v14m-5-5 5 5 5-5"
            stroke="currentColor"
            stroke-width="1.8"
          /></svg
      ></a>
    </div>
    <div class="hero__art">
      <div class="hero__art-field">
        <img
          class="hero__mark"
          src="/brand/mark-large.webp"
          alt="Фирменный знак Прохук"
          width="720"
          height="720"
          fetchpriority="high"
        /><span class="hero__corner" aria-hidden="true" />
      </div>
      <div class="hero__art-caption">
        <span>Сильная форма. Чистое пространство.</span
        ><span aria-hidden="true">↗</span>
      </div>
    </div>
    <div class="hero__bottom">
      <span>Открытая витрина компонентов</span
      ><span
        >Версия 1.0
        <span class="small-mark" aria-hidden="true">✳</span> 2026</span
      >
    </div>
  </UiContainer>
</template>

<template>
  <UiContainer as="section" class="hero" aria-labelledby="hero-title">
    <div class="hero__copy">
      <p class="edition"><span class="edition__dot" />Прохук / Каталог сети</p>
      <h1 id="hero-title">Прохук.<br />Больше, чем<br />вейпшоп.</h1>
      <p class="hero__intro">
        Информационный каталог товаров.<br />Выберите магазин, чтобы посмотреть
        ассортимент и наличие.
      </p>
      <NuxtLink to="/catalog" class="button button--primary button--large"
        >Открыть каталог <span aria-hidden="true">↗</span></NuxtLink
      >
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
        <span>Магазины, ассортимент и контакты.</span
        ><span aria-hidden="true">↗</span>
      </div>
    </div>
    <div class="hero__bottom">
      <span>Каталог Прохук</span
      ><span
        >Категории / Магазины
        <span class="small-mark" aria-hidden="true">✳</span></span
      >
    </div>
  </UiContainer>
</template>

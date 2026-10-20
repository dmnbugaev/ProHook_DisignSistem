<template>
  <UiContainer as="section" class="section"
    ><div class="feature-block">
      <div>
        <p class="eyebrow">ПроХук / О сети</p>
        <h2>Магазин рядом.<br />Каталог под рукой.</h2>
      </div>
      <div>
        <p>
          ПроХук — сеть специализированных магазинов. В каталоге собраны
          устройства, расходные материалы, аксессуары, напитки и снеки. Сведения
          о наличии доступны по выбранной точке.
        </p>
        <NuxtLink to="/about" class="text-link">О ПроХук ↗</NuxtLink>
      </div>
    </div>
    <div class="advantages">
      <div data-reveal>
        <span class="caption">01 / Выбор</span>
        <h3>Ассортимент</h3>
        <p>Категории и сведения о товарах на одной странице.</p>
      </div>
      <div data-reveal style="--reveal-step: 1">
        <span class="caption">02 / Детали</span>
        <h3>Ваш магазин</h3>
        <p>Цена и статус наличия для выбранной точки.</p>
      </div>
      <div data-reveal style="--reveal-step: 2">
        <span class="caption">03 / Простота</span>
        <h3>Удобный поиск</h3>
        <p>Категории и фильтры помогают найти нужное.</p>
      </div>
    </div></UiContainer
  >
</template>

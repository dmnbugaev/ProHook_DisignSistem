<template>
  <UiContainer
    as="section"
    id="motion"
    class="section"
    aria-labelledby="motion-title"
  >
    <div class="section-heading">
      <h2 id="motion-title">
        Движение.<br />
        В нужный момент.
      </h2>
      <p>
        Три формы собираются в композицию<br />
        вслед за естественной прокруткой.
      </p>
    </div>
    <MotionStudy />
    <div class="motion-notes">
      <div>
        <span class="caption">Интерфейс</span>
        <h3>120–180 мс</h3>
        <p>Короткий отклик на действие.</p>
      </div>
      <div>
        <span class="caption">Раскрытие</span>
        <h3>220–280 мс</h3>
        <p>Спокойная смена состояния.</p>
      </div>
      <div>
        <span class="caption">Доступность</span>
        <h3>Без лишнего движения</h3>
        <p>Статичная композиция при reduced motion.</p>
      </div>
    </div>
  </UiContainer>
</template>

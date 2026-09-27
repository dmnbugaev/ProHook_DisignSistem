<script setup lang="ts">
const colors = [
  { name: "Белый", token: "background", value: "#FFFFFF", class: "white" },
  { name: "Чёрный", token: "ink", value: "#000000", class: "black" },
  { name: "Жёлтый", token: "accent", value: "#FFFE00", class: "yellow" },
];
</script>
<template>
  <UiContainer
    as="section"
    id="identity"
    class="section"
    aria-labelledby="identity-title"
  >
    <div class="section-heading">
      <h2 id="identity-title">Основа характера</h2>
      <p>
        Три цвета. Один узнаваемый знак.<br />
        Достаточно, чтобы оставаться собой.
      </p>
    </div>
    <div class="identity-grid">
      <div class="logo-specimen">
        <img
          src="/brand/lockup.webp"
          alt="Прохук — полный логотип"
          width="360"
          height="360"
          loading="lazy"
        />
        <div class="specimen-caption">
          <span>Оригинальный логотип</span><span>Знак + подпись</span>
        </div>
      </div>
      <div class="identity-note">
        <span class="note-symbol" aria-hidden="true">↗</span>
        <h3>
          Форма задаёт<br />
          направление.
        </h3>
        <p>
          Сохраняем пропорции знака и свободное пространство вокруг. Не
          пересобираем логотип из текста и не добавляем эффекты.
        </p>
        <span class="caption">Охранное поле — от ¼ высоты знака.</span>
      </div>
    </div>
    <div class="palette">
      <article
        v-for="color in colors"
        :key="color.token"
        class="swatch"
        :class="`swatch--${color.class}`"
      >
        <div class="swatch__color">
          <span>{{ color.value }}</span
          ><span class="swatch__symbol" aria-hidden="true">{{
            color.class === "yellow" ? "+" : "○"
          }}</span>
        </div>
        <div class="swatch__label">
          <h3>{{ color.name }}</h3>
          <span>{{ color.token }}</span>
        </div>
      </article>
    </div>
    <div class="neutral-palette">
      <span class="caption">Служебные оттенки</span
      ><span
        ><i style="background: #f5f5f5" />Поверхность <code>#F5F5F5</code></span
      ><span><i style="background: #595959" />Подписи <code>#595959</code></span
      ><span
        ><i style="background: #d9d9d9" />Разделители <code>#D9D9D9</code></span
      >
    </div>
  </UiContainer>
</template>

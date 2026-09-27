<script setup lang="ts">
const dialogOpen = ref(false);
const title = ref("Визуальный язык");
const note = ref("");
const email = ref("");
const emailChecked = ref(false);
const emailError = computed(() =>
  emailChecked.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)
    ? "Введите адрес в формате name@example.com"
    : "",
);
const formStatus = ref("");
const density = ref("comfortable");
const grid = ref(true);
const alignment = ref("left");
const activeTab = ref("principle");
const state = ref("empty");
const busy = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
function loadExample() {
  busy.value = true;
  timer = setTimeout(() => {
    busy.value = false;
  }, 1200);
}
function validate() {
  emailChecked.value = true;
  formStatus.value = emailError.value
    ? ""
    : "Формат адреса верный. Данные никуда не отправлены.";
}
onBeforeUnmount(() => clearTimeout(timer));
const colors = [
  { name: "Белый", token: "background", value: "#FFFFFF", class: "white" },
  { name: "Чёрный", token: "ink", value: "#000000", class: "black" },
  { name: "Жёлтый", token: "accent", value: "#FFFE00", class: "yellow" },
];
const typeRows = [
  {
    name: "Display",
    size: "88 / 88 · 800",
    text: "Характер",
    class: "display",
  },
  {
    name: "Заголовок H1",
    size: "56 / 60 · 700",
    text: "Ясная форма",
    class: "h1",
  },
  {
    name: "Заголовок H2",
    size: "40 / 44 · 700",
    text: "Внимание к деталям",
    class: "h2",
  },
  {
    name: "Заголовок H3",
    size: "24 / 30 · 600",
    text: "Всё на своём месте",
    class: "h3",
  },
  {
    name: "Основной текст",
    size: "16 / 24 · 400",
    text: "Пространство помогает увидеть главное. Текст объясняет, что можно сделать дальше.",
    class: "body",
  },
  {
    name: "Подпись",
    size: "14 / 20 · 400",
    text: "Небольшая деталь — часть общей системы.",
    class: "caption",
  },
];
</script>

<template>
  <div id="top">
    <a class="skip-link" href="#main">Перейти к содержимому</a>
    <SiteHeader />
    <main id="main">
      <section class="hero container" aria-labelledby="hero-title">
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
      </section>

      <section
        id="identity"
        class="section container"
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
            ><i style="background: #f5f5f5" />Поверхность
            <code>#F5F5F5</code></span
          ><span
            ><i style="background: #595959" />Подписи <code>#595959</code></span
          ><span
            ><i style="background: #d9d9d9" />Разделители
            <code>#D9D9D9</code></span
          >
        </div>
      </section>

      <section
        id="typography"
        class="section container"
        aria-labelledby="type-title"
      >
        <div class="section-heading">
          <h2 id="type-title">Слова имеют вес</h2>
          <p>
            Golos Text. Уверенный в заголовках,<br />
            спокойный в длинном тексте.
          </p>
        </div>
        <div class="type-intro">
          <span class="type-intro__letters" aria-hidden="true">Аа</span>
          <div>
            <h3>Golos Text</h3>
            <p>
              АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ<br />
              abcdefghijklmnopqrstuvwxyz<br />
              0123456789 !?&@
            </p>
            <div class="weight-labels">
              <span>Regular 400</span><span>Medium 500</span
              ><span>Bold 700</span><span>ExtraBold 800</span>
            </div>
          </div>
        </div>
        <div class="type-scale">
          <div v-for="row in typeRows" :key="row.name" class="type-row">
            <div class="type-row__meta">
              <span>{{ row.name }}</span
              ><span class="caption">{{ row.size }}</span>
            </div>
            <p :class="`sample-${row.class}`">{{ row.text }}</p>
          </div>
        </div>
        <p class="caption section-footnote">
          Размер / интерлиньяж в px · насыщенность. На телефоне шкала
          адаптируется: Display 44 / 46, H1 36 / 40, H2 28 / 32.
        </p>
      </section>

      <section
        id="components"
        class="section container"
        aria-labelledby="components-title"
      >
        <div class="section-heading">
          <h2 id="components-title">
            Простые действия.<br />
            Понятный результат.
          </h2>
          <p>
            Компоненты можно попробовать.<br />
            Все данные здесь демонстрационные.
          </p>
        </div>
        <div class="component-row">
          <div class="component-row__intro">
            <h3>Кнопки и ссылки</h3>
            <p>
              Жёлтый выделяет главное действие. Остальные элементы поддерживают
              иерархию.
            </p>
            <span class="caption">48 / 56 px · радиус 6 px</span>
          </div>
          <div class="component-row__demo">
            <div class="button-samples">
              <div>
                <UiButton @click="dialogOpen = true">Открыть диалог</UiButton
                ><span class="caption">Основная</span>
              </div>
              <div>
                <UiButton
                  variant="secondary"
                  @click="loadExample"
                  :loading="busy"
                  >Попробовать</UiButton
                ><span class="caption">Вторичная · загрузка</span>
              </div>
              <div>
                <UiButton variant="quiet" @click="dialogOpen = true"
                  >Подробнее</UiButton
                ><span class="caption">Текстовая</span>
              </div>
            </div>
            <div class="button-samples button-samples--secondary">
              <div>
                <UiButton disabled>Недоступно</UiButton
                ><span class="caption">Disabled</span>
              </div>
              <div>
                <UiButton loading>Загрузка</UiButton
                ><span class="caption">Loading</span>
              </div>
              <div>
                <a class="text-link" href="#typography"
                  >Вернуться к типографике</a
                ><span class="caption">Ссылка в тексте</span>
              </div>
            </div>
            <p class="caption">
              Нажмите Tab, чтобы увидеть фокус. Кнопка «Недоступно» показывает
              отключённое состояние.
            </p>
          </div>
        </div>
        <div class="component-row">
          <div class="component-row__intro">
            <h3>Ввод и выбор</h3>
            <p>
              Подписи всегда видны. Подсказка помогает заполнить поле, ошибка
              объясняет, что исправить.
            </p>
            <span class="caption">Контур 1 px · зона касания от 44 px</span>
          </div>
          <form
            class="component-row__demo form-demo"
            novalidate
            @submit.prevent="validate"
          >
            <div class="form-grid">
              <UiField
                v-model="title"
                label="Название примера"
                hint="Любое название для демонстрации поля."
              /><UiSelect
                v-model="density"
                label="Плотность интерфейса"
                :options="[
                  { value: 'comfortable', label: 'Свободная' },
                  { value: 'compact', label: 'Компактная' },
                ]"
              />
            </div>
            <UiField
              v-model="email"
              label="Электронная почта · пример"
              type="email"
              placeholder="name@example.com"
              :error="emailError"
              hint="Проверяется только формат. Отправки нет."
              @input="formStatus = ''"
            /><UiField
              v-model="note"
              label="Комментарий"
              multiline
              placeholder="Попробуйте ввести несколько строк"
            />
            <div class="choices-grid">
              <fieldset>
                <legend>Отображение</legend>
                <label class="choice"
                  ><input v-model="grid" type="checkbox" />Показать сетку в
                  образце</label
                >
              </fieldset>
              <fieldset>
                <legend>Выравнивание текста</legend>
                <label class="choice"
                  ><input
                    v-model="alignment"
                    type="radio"
                    value="left"
                    name="alignment"
                  />По левому краю</label
                ><label class="choice"
                  ><input
                    v-model="alignment"
                    type="radio"
                    value="center"
                    name="alignment"
                  />По центру</label
                >
              </fieldset>
            </div>
            <div
              class="live-preview"
              :class="{
                'live-preview--grid': grid,
                'live-preview--compact': density === 'compact',
              }"
              :style="{ textAlign: alignment as 'left' | 'center' }"
            >
              <span class="caption">Предпросмотр</span>
              <h3>{{ title || "Название примера" }}</h3>
              <p>
                {{
                  note || "Измените поля, чтобы увидеть настройки в действии."
                }}
              </p>
            </div>
            <div>
              <UiButton type="submit" variant="secondary"
                >Проверить формат</UiButton
              >
              <p class="form-status" role="status">{{ formStatus }}</p>
            </div>
          </form>
        </div>
        <div class="component-row">
          <div class="component-row__intro">
            <h3>Вкладки</h3>
            <p>
              Переключайте мышью или стрелками на клавиатуре. Home и End
              переходят к краям списка.
            </p>
          </div>
          <div class="component-row__demo">
            <UiTabs
              v-model="activeTab"
              label="Принципы системы"
              :tabs="[
                { value: 'principle', label: 'Принцип' },
                { value: 'detail', label: 'Детали' },
                { value: 'usage', label: 'Применение' },
              ]"
              ><template #principle
                ><h3>Меньше шума, больше смысла.</h3>
                <p>
                  Каждый элемент решает задачу. Свободное пространство разделяет
                  блоки, размер показывает важность, акцент направляет внимание.
                </p></template
              ><template #detail
                ><h3>Единый ритм.</h3>
                <p>
                  Отступы кратны 4 px. Основной ряд: 8, 16, 24, 32, 48, 64, 96 и
                  128 px. Соседние секции делят один интервал.
                </p></template
              ><template #usage
                ><h3>Одинаково понятно везде.</h3>
                <p>
                  Содержание сохраняется на телефоне. Композиция меняется вместе
                  с экраном, а действия остаются доступными.
                </p></template
              ></UiTabs
            >
          </div>
        </div>
        <div class="component-row">
          <div class="component-row__intro">
            <h3>Информационная карточка</h3>
            <p>
              Изображение, заголовок, краткое пояснение. Содержание видно сразу,
              без наведения.
            </p>
            <span class="caption">Демонстрационный материал</span>
          </div>
          <div class="component-row__demo card-grid">
            <UiCard
              title="Геометрия узнаваемости"
              href="#identity"
              image="/brand/icon.webp"
              image-alt="Знак на жёлтом ступенчатом поле"
              label="Айдентика"
              >Оригинальный знак и правила его размещения в цифровой
              среде.</UiCard
            >
            <div class="card-note">
              <h3>
                Пространство —<br />
                тоже инструмент.
              </h3>
              <p>
                Общая сетка связывает элементы. Карточке не нужна тень, чтобы
                занять своё место.
              </p>
              <a class="text-link" href="#motion">Посмотреть движение</a>
            </div>
          </div>
        </div>
      </section>

      <section
        id="states"
        class="section container"
        aria-labelledby="states-title"
      >
        <div class="section-heading">
          <h2 id="states-title">
            Ясность в любом<br />
            состоянии
          </h2>
          <p>
            Даже когда данных нет,<br />
            следующий шаг остаётся понятным.
          </p>
        </div>
        <UiTabs
          v-model="state"
          label="Служебные состояния"
          :tabs="[
            { value: 'empty', label: 'Пусто' },
            { value: 'error', label: 'Ошибка' },
            { value: 'loading', label: 'Загрузка' },
          ]"
          ><template #empty
            ><div class="state-example">
              <svg
                width="56"
                height="56"
                viewBox="0 0 56 56"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M9 18h38v29H9zM17 9h22v9H17zM21 29h14"
                  stroke="currentColor"
                  stroke-width="2"
                />
              </svg>
              <h3>Здесь пока ничего нет</h3>
              <p>
                Это пример пустого списка.<br />
                Посмотрите, как выглядят другие состояния.
              </p>
              <UiButton variant="secondary" @click="state = 'error'"
                >Показать ошибку</UiButton
              >
            </div></template
          ><template #error
            ><div class="state-example">
              <span class="state-symbol" aria-hidden="true">!</span>
              <h3>Не удалось загрузить пример</h3>
              <p>
                Демонстрация ошибки соединения.<br />
                Кнопка ниже переключит образец на загрузку.
              </p>
              <UiButton variant="secondary" @click="state = 'loading'"
                >Повторить</UiButton
              >
            </div></template
          ><template #loading
            ><div
              class="skeleton-example"
              aria-label="Пример загрузки"
              role="status"
            >
              <div class="skeleton-box" />
              <div class="skeleton-lines"><span /><span /><span /></div>
              <p class="caption">
                Статичный skeleton сохраняет место для содержимого.
              </p>
            </div></template
          ></UiTabs
        >
      </section>

      <section
        id="motion"
        class="section container"
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
      </section>
    </main>
    <footer class="footer container">
      <a href="#top" aria-label="Прохук — в начало"
        ><img src="/brand/mark.webp" width="40" height="40" alt=""
      /></a>
      <p>
        Прохук. Дизайн-система.<br />
        <span class="caption">Витрина интерфейса · 2026</span>
      </p>
      <a class="text-link" href="#top">В начало страницы</a>
    </footer>
    <UiDialog v-model="dialogOpen" title="Всё внимание — здесь"
      ><template #default="{ close }"
        ><p>
          Это демонстрационный диалог. Пока он открыт, фокус остаётся внутри, а
          страница на фоне недоступна.
        </p>
        <p class="caption">
          Закройте окно кнопкой или клавишей Escape. Фокус вернётся к элементу,
          который его открыл.
        </p>
        <div class="dialog__actions">
          <UiButton @click="close">Понятно</UiButton
          ><UiButton variant="secondary" @click="close">Закрыть окно</UiButton>
        </div></template
      ></UiDialog
    >
  </div>
</template>

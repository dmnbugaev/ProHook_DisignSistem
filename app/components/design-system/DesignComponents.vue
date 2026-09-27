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
</script>
<template>
  <UiContainer
    as="section"
    id="components"
    class="section"
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
            <UiButton variant="secondary" @click="loadExample" :loading="busy"
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
            <a class="text-link" href="#typography">Вернуться к типографике</a
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
            <UiCheckbox v-model="grid" label="Показать сетку в образце" />
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
            {{ note || "Измените поля, чтобы увидеть настройки в действии." }}
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
          Переключайте мышью или стрелками на клавиатуре. Home и End переходят к
          краям списка.
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
              Отступы кратны 4 px. Основной ряд: 8, 16, 24, 32, 48, 64, 96 и 128
              px. Соседние секции делят один интервал.
            </p></template
          ><template #usage
            ><h3>Одинаково понятно везде.</h3>
            <p>
              Содержание сохраняется на телефоне. Композиция меняется вместе с
              экраном, а действия остаются доступными.
            </p></template
          ></UiTabs
        >
      </div>
    </div>
    <div class="component-row">
      <div class="component-row__intro">
        <h3>Информационная карточка</h3>
        <p>
          Изображение, заголовок, краткое пояснение. Содержание видно сразу, без
          наведения.
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
          >Оригинальный знак и правила его размещения в цифровой среде.</UiCard
        >
        <div class="card-note">
          <h3>
            Пространство —<br />
            тоже инструмент.
          </h3>
          <p>
            Общая сетка связывает элементы. Карточке не нужна тень, чтобы занять
            своё место.
          </p>
          <a class="text-link" href="#motion">Посмотреть движение</a>
        </div>
      </div>
    </div>
  </UiContainer>
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
</template>

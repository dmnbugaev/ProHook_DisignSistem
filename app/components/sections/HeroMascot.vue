<script setup lang="ts">
/**
 * Талисман ПроХука — оригинальный персонаж по эскизу владельца:
 * жёлтая маска с тёмными «заплатками» глаз, два клинка за спиной,
 * шея между маской и торсом. Обе руки двухзвенные (плечо → локоть →
 * кисть): каждый сустав — своя группа с transform-origin в
 * координатах viewBox, позы решены обратной кинематикой (хореография
 * и треки — в блоке «Прорыв» main.css). Правая рука после прорыва
 * вкладывает клинок в ножны за спиной (эфес остаётся над правым
 * плечом — видимый клинок уходит за торс) и машет ладонью, затем
 * обе руки складываются в «сердечко» у груди. Кисть вложена в
 * предплечье — пальцы всегда смотрят вдоль него. Здесь только
 * геометрия; рука рисуется перед головой, клинки — за торсом.
 */
</script>
<template>
  <div class="mascot" aria-hidden="true">
    <div class="mascot__leap">
      <svg class="mascot__figure" viewBox="0 0 256 256">
        <defs>
          <!-- Клинок вертикально, остриём вверх, центрирован на x=176:
               слева позиционируется <use>-трансформом (крест за спиной),
               правый живёт своей группой и анимируется в ножны. -->
          <g
            id="mascot-sword"
            style="stroke: var(--ink)"
            stroke-width="3.5"
            stroke-linejoin="round"
          >
            <rect x="169" y="38" width="14" height="86" rx="7" fill="#415968" />
            <path d="M172 58l8-6M172 80l8-6M172 102l8-6" fill="none" />
            <rect
              x="159"
              y="124"
              width="34"
              height="9"
              rx="4.5"
              fill="#C4D3DC"
            />
            <rect
              x="170.5"
              y="133"
              width="11"
              height="20"
              rx="5"
              fill="#49392C"
            />
            <circle cx="176" cy="160" r="7.5" fill="#C4D3DC" />
          </g>
          <g
            id="mascot-torso"
            style="stroke: var(--ink)"
            stroke-width="5"
            stroke-linejoin="round"
          >
            <!-- Шея: соединяет маску и торс, видна в разветвлении слева
                 и справа от нижней кромки маски. -->
            <path
              d="M116 134L140 134L147 164L109 164Z"
              fill="#172124"
              stroke-width="4"
            />
            <path
              d="M82 147Q48 147 42 183L33 240Q33 250 48 250H208Q223 250 223 238L214 183Q208 147 174 147L150 153H106Z"
              fill="#172124"
            />
            <path
              d="M94 151L124 160V244H65L58 180Q69 153 94 151Z"
              style="fill: var(--accent)"
            />
            <path
              d="M162 151L132 160V244H191L198 180Q187 153 162 151Z"
              style="fill: var(--accent)"
            />
            <path d="M127 160V242" fill="none" />
            <!-- Дужка ножен на правом плече: не лента через грудь
                 (толстая портупея поперёк торса читалась как третья
                 рука), а короткий ремень у плеча — клинок за спиной
                 подсказывает видимый эфес над плечом. -->
            <path
              d="M177 157Q189 140 201 154"
              style="stroke: var(--ink)"
              stroke-width="14"
              fill="none"
              stroke-linecap="round"
            />
            <path
              d="M177 157Q189 140 201 154"
              stroke="#49392C"
              stroke-width="9"
              fill="none"
              stroke-linecap="round"
            />
            <path
              d="M73 211Q97 202 119 216M137 216Q159 202 183 211"
              stroke="#BCB900"
              stroke-width="3"
              fill="none"
            />
            <path d="M56 224H200V244H56Z" fill="#49392C" />
            <rect
              x="114"
              y="220"
              width="28"
              height="28"
              rx="8"
              style="fill: var(--accent)"
            />
            <rect x="85" y="176" width="12" height="20" rx="4" fill="#C4D3DC" />
            <rect
              x="159"
              y="176"
              width="12"
              height="20"
              rx="4"
              fill="#C4D3DC"
            />
          </g>
          <g
            id="mascot-mask"
            style="stroke: var(--ink)"
            stroke-linejoin="round"
          >
            <path
              d="M128 20C93 18 77 39 77 76C77 110 94 140 128 148C162 140 179 110 179 76C179 39 163 18 128 20Z"
              style="fill: var(--accent)"
              stroke-width="5"
            />
            <path
              d="M88 60Q99 46 114 53Q126 65 120 95Q111 120 95 113Q82 106 84 82Z"
              fill="#172124"
              stroke-width="3"
            />
            <path
              d="M168 60Q157 46 142 53Q130 65 136 95Q145 120 161 113Q174 106 172 82Z"
              fill="#172124"
              stroke-width="3"
            />
          </g>
          <g id="mascot-eyes-normal" fill="#fff">
            <path d="M91 85Q102 75 114 86Q102 83 92 91Z" />
            <path d="M142 86Q154 75 165 85L164 91Q153 83 142 86Z" />
          </g>
          <g
            id="mascot-eyes-happy"
            style="stroke: #fff"
            stroke-width="4"
            stroke-linecap="round"
            fill="none"
          >
            <path d="M93 86Q103 72 114 86" />
            <path d="M142 86Q153 72 164 86" />
          </g>
        </defs>

        <!-- Клинки за спиной: левый закреплён крестом, правый после
             прорыва уходит в ножны (базовое состояние = в ножнах,
             эфес над правым плечом). -->
        <g class="mascot__gear">
          <g class="mascot__sword mascot__sword--l">
            <use
              href="#mascot-sword"
              transform="translate(-96,9) rotate(-25,176,101)"
            />
          </g>
          <g class="mascot__sword mascot__sword--r">
            <use href="#mascot-sword" />
          </g>
        </g>
        <!-- Корпус: торс с дужкой ножен и шеей. -->
        <g class="mascot__body">
          <use href="#mascot-torso" />
        </g>
        <!-- Голова: маска + переключаемые глаза. Руки рисуются ПЕРЕД
             головой: правая кисть при вкладывании держится у эфеса
             над плечом, маску не пересекает. -->
        <g class="mascot__head">
          <use href="#mascot-mask" />
          <g class="mascot__eyes mascot__eyes--normal">
            <use href="#mascot-eyes-normal" />
          </g>
          <g class="mascot__eyes mascot__eyes--happy">
            <use href="#mascot-eyes-happy" />
          </g>
        </g>
        <!-- Правая рука — двухзвенная; нарисована в финальной позе
             «сердечка» (локоть у пояса, кисть у груди). -->
        <g class="mascot__arm mascot__arm--right">
          <!-- Плечо: капсула сустав-локоть (сдвоенный штрих = кант). -->
          <path class="m-bone m-bone--ink" d="M183 167L181 210" />
          <path class="m-bone m-bone--suit" d="M183 167L181 210" />
          <g class="mascot__fore">
            <!-- Предплечье: локоть-запястье + жёлтая повязка. -->
            <path class="m-bone m-bone--ink" d="M181 210L155 172" />
            <path class="m-bone m-bone--suit" d="M181 210L155 172" />
            <path class="m-band" d="M162 195L174 187" />
            <!-- Кисть: перчатка с пальцами накрест, повёрнута вдоль
                 предплечья (пальцы к центру груди). -->
            <g class="mascot__hand" transform="rotate(-34,155,172)">
              <rect
                class="m-glove"
                x="141"
                y="148"
                width="26"
                height="24"
                rx="11"
              />
              <path class="m-finger m-finger--ink" d="M146 150L142 130" />
              <path class="m-finger m-finger--suit" d="M146 150L142 130" />
              <path class="m-finger m-finger--ink" d="M159 158L145 136" />
              <path class="m-finger m-finger--suit" d="M159 158L145 136" />
            </g>
          </g>
        </g>
        <!-- Левая рука — зеркальная двухзвенная; нарисована в стойке
             (рука вдоль тела, кисть у пояса), в «сердечко» приходит
             анимацией (база CSS = финальная поза). -->
        <g class="mascot__arm mascot__arm--left">
          <path class="m-bone m-bone--ink" d="M71 166L37 193" />
          <path class="m-bone m-bone--suit" d="M71 166L37 193" />
          <g class="mascot__fore">
            <path class="m-bone m-bone--ink" d="M37 193L75 220" />
            <path class="m-bone m-bone--suit" d="M37 193L75 220" />
            <path class="m-band" d="M52 213L61 201" />
            <g class="mascot__hand" transform="rotate(125,75,220)">
              <rect
                class="m-glove"
                x="61"
                y="196"
                width="26"
                height="24"
                rx="11"
              />
              <path class="m-finger m-finger--ink" d="M66 198L62 178" />
              <path class="m-finger m-finger--suit" d="M66 198L62 178" />
              <path class="m-finger m-finger--ink" d="M79 206L65 184" />
              <path class="m-finger m-finger--suit" d="M79 206L65 184" />
            </g>
          </g>
        </g>
        <!-- Сердечко между кистями у груди: вспыхивает, когда обе
             руки сложились, и тихо пульсирует в idle. -->
        <path
          class="mascot__heart"
          d="M128 160C121 154 110 151 110 142C110 135 116.5 132 122 135.5C124.5 137 126.5 139 128 141C129.5 139 131.5 137 134 135.5C139.5 132 146 135 146 142C146 151 135 154 128 160Z"
        />
        <!-- Искры у сердечка. -->
        <path class="mascot__spark" d="M96 132L100 124L104 132L100 140Z" />
        <path
          class="mascot__spark mascot__spark--2"
          d="M152 128L156 120L160 128L156 136Z"
        />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Талисман ПроХука — оригинальный персонаж по эскизу владельца:
 * жёлтая маска с тёмными «заплатками» глаз, два клинка за спиной,
 * вскинутая рука-«победа». Геометрия — inline-SVG в координатах
 * viewBox 256; вся хореография прорыва стены — в блоке «Вскрытие»
 * main.css, пивоты задаются transform-origin в координатах viewBox
 * (transform-box: view-box). Глаза — две группы (обычные щёлки и
 * радостные дуги), CSS их перекрёстно переключает после вскипа руки.
 */
</script>
<template>
  <div class="mascot" aria-hidden="true">
    <div class="mascot__leap">
      <svg class="mascot__figure" viewBox="0 0 256 256">
        <defs>
          <g id="mascot-swords" style="stroke: var(--ink)" stroke-width="4">
            <g transform="rotate(-25 80 110)">
              <rect
                x="70"
                y="48"
                width="20"
                height="106"
                rx="9"
                fill="#415968"
              />
              <path d="M73 67l14-10M73 90l14-10M73 113l14-10M73 136l14-10" />
            </g>
            <g transform="rotate(25 176 110)">
              <rect
                x="166"
                y="48"
                width="20"
                height="106"
                rx="9"
                fill="#415968"
              />
              <path
                d="M169 57l14 10M169 80l14 10M169 103l14 10M169 126l14 10"
              />
            </g>
          </g>
          <g
            id="mascot-torso"
            style="stroke: var(--ink)"
            stroke-width="5"
            stroke-linejoin="round"
          >
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

        <!-- Клинки крестом за спиной. -->
        <g class="mascot__gear">
          <use href="#mascot-swords" />
        </g>
        <!-- Корпус. -->
        <g class="mascot__body">
          <use href="#mascot-torso" />
        </g>
        <!-- Голова: маска + переключаемые глаза. -->
        <g class="mascot__head">
          <use href="#mascot-mask" />
          <g class="mascot__eyes mascot__eyes--normal">
            <use href="#mascot-eyes-normal" />
          </g>
          <g class="mascot__eyes mascot__eyes--happy">
            <use href="#mascot-eyes-happy" />
          </g>
        </g>
        <!-- Левая рука — ловит равновесие на посадке. -->
        <g
          class="mascot__arm mascot__arm--left"
          style="stroke: var(--ink)"
          stroke-width="5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M64 169Q39 170 35 205Q34 224 58 228L91 216" fill="#172124" />
          <path d="M55 187L48 211L72 218L88 210" style="fill: var(--accent)" />
        </g>
        <!-- Правая рука — вскидывает «победу» после прорыва. -->
        <g
          class="mascot__arm mascot__arm--right"
          style="stroke: var(--ink)"
          stroke-width="5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M187 166Q207 166 213 144L217 89L196 84L188 127L176 153Z"
            fill="#172124"
          />
          <path
            d="M193 155L202 125L215 132L210 158Z"
            style="fill: var(--accent)"
          />
          <path
            d="M194 92Q183 77 178 59Q176 53 181 51Q186 50 195 65L187 35Q185 29 191 27Q197 26 199 32L209 54L204 27Q203 20 209 20Q216 20 216 27L220 51L222 34Q223 28 229 31Q233 34 231 41L232 66Q234 79 216 100Z"
            style="fill: var(--accent)"
          />
        </g>
        <!-- Искры у вскинутой руки. -->
        <path class="mascot__spark" d="M162 34L166 26L170 34L166 42Z" />
        <path
          class="mascot__spark mascot__spark--2"
          d="M242 78L246 70L250 78L246 86Z"
        />
      </svg>
    </div>
  </div>
</template>

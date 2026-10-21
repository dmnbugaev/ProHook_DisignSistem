<script setup lang="ts">
/**
 * Талисман ПроХука — новая редакция персонажа от 21.10 («жёлтый
 * Дэдпул»): жёлтый костюм с тёмными грудными панелями, ремни с
 * заклёшками, пояс с пряжкой, клинки за спиной, белая «стикерная»
 * окантовка (фильтр mascot-sticker) — фигура читается и поверх
 * жёлтого ядра. Обе руки двухзвенные (плечо → локоть → кисть),
 * локти решаются обратной кинематикой; кисти — по пять пальцев
 * кубическими кривыми, позы FIST/WAVE/HEART интерполируются.
 * Правая рука машет, затем обе кисти сходятся у груди и между ними
 * проявляется заполненное симметричное «сердечко»: указательные
 * пальцы касаются верхней выемки, большие — нижнего угла.
 * Разметка отрисована в ФИНАЛЬНОЙ позе «сердечка»: её видят SSR,
 * no-JS и prefers-reduced-motion (скрипт тогда не запускается).
 * На клиенте хореография стартует после прорыва стены (~1.45с,
 * прыжок- CSS на обёртке mascot__leap). Здесь только геометрия и
 * скрипт; материалы — в main.css.
 */
interface Point {
  x: number;
  y: number;
}
type FingerName = "index" | "middle" | "ring" | "little" | "thumb";
type FingerPair = [SVGPathElement?, SVGPathElement?];
type Pose = Record<FingerName, number[]>;
type BlendedPose = Record<FingerName, number[]>;

/** Длительность хореографии: последнее мигание — 5.3с, дальше hold. */
const TOTAL = 5.6;
/** Старт после прорыва: CSS-прыжок садится ~1.17с, даём пыли осесть. */
const START_DELAY = 1.45;

/** Длины звеньев руки (плечо, предплечье) в координатах viewBox. */
const ARM_A = 140;
const ARM_B = 150;

const SHOULDERS = {
  L: { x: 161, y: 263 },
  // Зеркально левому относительно x=256: иначе локти в «сердечке»
  // выходят на разной высоте (в демо плечо было 355 — центр 258).
  R: { x: 351, y: 263 },
} as const satisfies Record<"L" | "R", Point>;

/** Кисть на поясе (левая) и поднятая для привета (правая) — старт. */
const REST_L: Point = { x: 189, y: 390 };
const WAVE_R: Point = { x: 418, y: 114 };
/** Финал: кисти симметричны у груди, указательные сходятся в x=256. */
const HEART_L: Point = { x: 213, y: 360 };
const HEART_R: Point = { x: 299, y: 360 };

/** Позы пальцев относительно запястья: M(x,y) + две кубические
 * кривые (проксимальная + дистальная фаланги). Пальцы одной ширины,
 * пропорции живой кисти: средний длиннее, мизинец заметно короче.
 * WAVE — раскрытая кисть: пальцы прямые с лёгким живым прогибом,
 * кончик продолжает направление пальца (без «крючка»). В «сердечке»
 * указательные и большие трассируют контур фигуры-сердца (кривые
 * сняты с той же параметрической кривой и смещены наружу на 1.5),
 * кончики сходятся над выемкой и в нижнем угле; остальные поджаты. */
const POSE: Record<"FIST" | "WAVE" | "HEART", Pose> = {
  FIST: {
    index: [-13, -25, -19, -33, -17, -41, -9, -39, -2, -37, -1, -31, -4, -26],
    middle: [-3, -28, -6, -38, 2, -43, 9, -37, 13, -32, 9, -27, 3, -26],
    ring: [7, -27, 5, -37, 13, -40, 19, -33, 22, -28, 18, -24, 13, -23],
    little: [16, -20, 14, -29, 21, -31, 26, -25, 29, -20, 25, -16, 20, -16],
    thumb: [14, -8, 22, -9, 26, -2, 22, 3, 18, 7, 12, 5, 11, 1],
  },
  WAVE: {
    index: [
      -14, -28, -17.8, -34.3, -22.2, -40.3, -25.4, -46.9, -28.7, -53.5, -30.7,
      -60.7, -33.3, -67.6,
    ],
    middle: [
      -4, -30, -5.7, -37.8, -8, -45.6, -9.2, -53.5, -10.5, -61.4, -10.7, -69.4,
      -11.5, -77.4,
    ],
    ring: [
      5, -29, 6.4, -36.2, 8.3, -43.4, 9.2, -50.7, 10.1, -57.9, 10, -65.4, 10.4,
      -72.7,
    ],
    little: [
      13, -23, 16.1, -28, 20, -32.7, 22.4, -38, 24.8, -43.3, 25.6, -49.3, 27.2,
      -55,
    ],
    thumb: [
      14, -8, 18.9, -10.5, 24.2, -12.5, 28.8, -15.5, 33.4, -18.6, 37.2, -22.8,
      41.4, -26.4,
    ],
  },
  HEART: {
    index: [
      9.6, -38.8, 12.6, -43, 17.6, -46.2, 22.7, -47.1, 27.5, -47.9, 32.9, -46.5,
      36.7, -43.7,
    ],
    middle: [-3, -28, -6, -38, 2, -43, 9, -37, 13, -32, 9, -27, 3, -26],
    ring: [7, -27, 5, -37, 13, -40, 19, -33, 22, -28, 18, -24, 13, -23],
    little: [16, -20, 14, -29, 21, -31, 26, -25, 29, -20, 25, -16, 20, -16],
    thumb: [
      21.5, -8.3, 26, -4.2, 30.9, -0.4, 35.3, 3.8, 38.8, 7.2, 42.4, 11, 44,
      15.6,
    ],
  },
};

const FINGERS: FingerName[] = ["middle", "ring", "little", "index", "thumb"];

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function ease(v: number) {
  v = clamp(v);
  return v * v * (3 - 2 * v);
}

function progress(t: number, a: number, b: number) {
  return ease((t - a) / (b - a));
}

function blendPoint(a: Point, b: Point, k: number): Point {
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
}

function clampLength(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** Локоть — обратная кинематика двух звеньев; выбор стороны изгиба
 * фиксирован (левый локоть левее плеча, правый правее), между кадрами
 * не меняется — нет перескоков. */
function solveElbow(s: Point, w: Point, side: "L" | "R"): Point {
  const dx = w.x - s.x;
  const dy = w.y - s.y;
  const actual = Math.hypot(dx, dy);

  const d = clampLength(
    actual,
    Math.abs(ARM_A - ARM_B) + 0.01,
    ARM_A + ARM_B - 0.01,
  );

  const ux = dx / Math.max(actual, 0.001);
  const uy = dy / Math.max(actual, 0.001);

  const a = (ARM_A * ARM_A - ARM_B * ARM_B + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ARM_A * ARM_A - a * a));

  const mx = s.x + ux * a;
  const my = s.y + uy * a;

  const first = { x: mx - uy * h, y: my + ux * h };
  const second = { x: mx + uy * h, y: my - ux * h };

  if (side === "L") return first.x < second.x ? first : second;
  return first.x > second.x ? first : second;
}

function segment(a: Point, b: Point) {
  return `M${a.x} ${a.y}L${b.x} ${b.y}`;
}

function cubicPath(v: number[]) {
  return `M${v[0]} ${v[1]} C${v[2]} ${v[3]} ${v[4]} ${v[5]} ${v[6]} ${v[7]} C${v[8]} ${v[9]} ${v[10]} ${v[11]} ${v[12]} ${v[13]}`;
}

function blendArray(a: number[], b: number[], k: number) {
  return a.map((v, i) => lerp(v, b[i] ?? 0, k));
}

function blendPose(a: Pose, b: Pose, k: number): BlendedPose {
  return Object.fromEntries(
    FINGERS.map((name) => [name, blendArray(a[name], b[name], k)]),
  ) as BlendedPose;
}

const upLEl = ref<SVGGElement | null>(null);
const upREl = ref<SVGGElement | null>(null);
const lowLEl = ref<SVGGElement | null>(null);
const lowREl = ref<SVGGElement | null>(null);
const handLEl = ref<SVGGElement | null>(null);
const handREl = ref<SVGGElement | null>(null);
const headEl = ref<SVGGElement | null>(null);
const eyesEl = ref<SVGGElement | null>(null);
const heartEl = ref<SVGPathElement | null>(null);

interface ArmElements {
  upperEdge: SVGPathElement | undefined;
  upperBase: SVGPathElement | undefined;
  upperSuit: SVGPathElement | undefined;
  foreEdge: SVGPathElement | undefined;
  foreBase: SVGPathElement | undefined;
}

let arms: Record<"L" | "R", ArmElements>;
let hands: Record<"L" | "R", Record<FingerName, FingerPair>>;

function pathByClass(root: SVGGElement | null, className: string) {
  return root?.querySelector<SVGPathElement>(`.${className}`) ?? undefined;
}

function collectArm(
  upper: SVGGElement | null,
  fore: SVGGElement | null,
): ArmElements {
  return {
    upperEdge: pathByClass(upper, "mascot__edge"),
    upperBase: pathByClass(upper, "mascot__base"),
    upperSuit: pathByClass(upper, "mascot__suit"),
    foreEdge: pathByClass(fore, "mascot__edge"),
    foreBase: pathByClass(fore, "mascot__base"),
  };
}

function collectHand(
  group: SVGGElement | null,
): Record<FingerName, FingerPair> {
  return Object.fromEntries(
    FINGERS.map((name) => [
      name,
      Array.from(
        group?.querySelectorAll<SVGPathElement>(`[data-finger="${name}"]`) ??
          [],
      ) as FingerPair,
    ]),
  ) as Record<FingerName, FingerPair>;
}

const setD = (path: SVGPathElement | undefined, d: string) =>
  path?.setAttribute("d", d);

function drawArm(side: "L" | "R", wrist: Point) {
  const shoulder = SHOULDERS[side];
  const elbow = solveElbow(shoulder, wrist, side);

  const upper = segment(shoulder, elbow);
  const lower = segment(elbow, wrist);

  const arm = arms[side];
  setD(arm.upperEdge, upper);
  setD(arm.upperBase, upper);
  setD(arm.foreEdge, lower);
  setD(arm.foreBase, lower);

  // Жёлтая вставка бицепса — короткий сегмент от плеча.
  const begin = blendPoint(shoulder, elbow, 0.13);
  const end = blendPoint(shoulder, elbow, 0.77);
  setD(arm.upperSuit, segment(begin, end));
}

function updateHand(
  root: SVGGElement | null,
  hand: Record<FingerName, FingerPair>,
  position: Point,
  pose: BlendedPose,
  mirror: boolean,
  rotation: number,
) {
  root?.setAttribute(
    "transform",
    `translate(${position.x} ${position.y}) rotate(${rotation}) scale(${mirror ? -1 : 1} 1)`,
  );
  for (const name of FINGERS) {
    const d = cubicPath(pose[name]);
    for (const path of hand[name]) path?.setAttribute("d", d);
  }
}

function render(t: number) {
  // Взмах заканчивается до перехода к сердечку.
  const heartK = progress(t, 2.65, 4.25);

  let wave = 0;
  if (t >= 0.25 && t <= 2.65) {
    const u = (t - 0.25) / 2.4;
    const envelope = Math.sin(Math.PI * u) ** 2;
    wave = Math.sin(u * Math.PI * 6) * envelope;
  }

  const leftWrist = blendPoint(REST_L, HEART_L, heartK);
  const rightWrist = blendPoint(
    { x: WAVE_R.x + 7 * wave, y: WAVE_R.y + 3 * wave },
    HEART_R,
    heartK,
  );

  drawArm("L", leftWrist);
  drawArm("R", rightWrist);

  const leftPose = blendPose(POSE.FIST, POSE.HEART, heartK);
  const rightPose = blendPose(POSE.WAVE, POSE.HEART, heartK);

  updateHand(handLEl.value, hands.L, leftWrist, leftPose, false, 0);
  updateHand(
    handREl.value,
    hands.R,
    rightWrist,
    rightPose,
    true,
    12 * wave * (1 - heartK),
  );

  // Лёгкий наклон головы вслед за взмахом.
  const headTilt = 2.5 * wave * (1 - heartK);
  headEl.value?.setAttribute("transform", `rotate(${headTilt} 256 225)`);

  // Сердечко: проявляется во второй половине перехода, когда кисти
  // уже сходятся; лёгкий овершут и посадка в 1 к финалу.
  const pop = clamp((heartK - 0.5) * 2);
  const heartScale = 1.15 * pop - 0.15 * pop ** 3;
  heartEl.value?.setAttribute(
    "transform",
    `translate(256 351) scale(${heartScale.toFixed(4)}) translate(-256 -351)`,
  );

  // Мигания: три коротких щелчка за ролик.
  let openness = 1;
  for (const center of [1.45, 3.65, 5.3]) {
    const d = Math.abs(t - center);
    if (d < 0.095) openness = Math.min(openness, 0.15 + (0.85 * d) / 0.095);
  }
  eyesEl.value?.setAttribute(
    "transform",
    `translate(0 155) scale(1 ${openness}) translate(0 -155)`,
  );
}

let frameId = 0;
let startedAt = 0;

function tick(now: number) {
  const t = (now - startedAt) / 1000;
  render(Math.min(Math.max(t, 0), TOTAL));
  if (t < TOTAL) frameId = requestAnimationFrame(tick);
  else frameId = 0;
}

onMounted(() => {
  arms = {
    L: collectArm(upLEl.value, lowLEl.value),
    R: collectArm(upREl.value, lowREl.value),
  };
  hands = { L: collectHand(handLEl.value), R: collectHand(handREl.value) };

  // Разметка уже стоит в финальной позе «сердечка» — при запрете
  // движения оставляем её как статичную композицию.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // До старта — стойка: левая кисть на поясе, правая поднята кулаком
  // (эффектно смотрится в момент прорыва стены).
  render(0);
  startedAt = performance.now() + START_DELAY * 1000;
  frameId = requestAnimationFrame(tick);
});

onBeforeUnmount(() => {
  if (frameId) cancelAnimationFrame(frameId);
});
</script>
<template>
  <div class="mascot" aria-hidden="true">
    <div class="mascot__leap">
      <!-- Разметка отрисована в финальной позе «сердечка»: запечённые d
           путей рук/пальцев и трансформы кистей совпадают с решением
           скрипта в t=TOTAL (SRH/no-JS/reduced-motion). Скрипт на
           клиенте переписывает их каждый кадр. -->
      <svg class="mascot__figure" viewBox="0 0 512 520">
        <defs>
          <!-- Стикерная окантовка: белое расширение силуэта под фигурой. -->
          <filter
            id="mascot-sticker"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feMorphology
              in="SourceAlpha"
              operator="dilate"
              radius="6"
              result="expanded"
            />
            <feFlood flood-color="#fff" result="white" />
            <feComposite
              in="white"
              in2="expanded"
              operator="in"
              result="border"
            />
            <feMerge>
              <feMergeNode in="border" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g class="mascot__sticker" filter="url(#mascot-sticker)">
          <!-- Клинки за спиной (рукояти над плечами); доводка после
               посадки и дыхание idle — CSS на группе. -->
          <g class="mascot__gear" style="stroke: var(--ink)" stroke-width="4">
            <g transform="rotate(-25 190 177)">
              <rect
                x="178"
                y="75"
                width="24"
                height="178"
                rx="10"
                fill="#43596b"
              />
              <path
                d="M181 94l18-11M181 123l18-11M181 152l18-11M181 181l18-11"
                fill="none"
                style="stroke: var(--accent)"
              />
            </g>
            <g transform="rotate(25 322 177)">
              <rect
                x="310"
                y="75"
                width="24"
                height="178"
                rx="10"
                fill="#43596b"
              />
              <path
                d="M313 83l18 11M313 112l18 11M313 141l18 11M313 170l18 11"
                fill="none"
                style="stroke: var(--accent)"
              />
            </g>
          </g>

          <!-- Плечи: капсулы за торсом (кант, тёмная подложка, жёлтая
               вставка бицепса). -->
          <g ref="upLEl" class="mascot__limb mascot__limb--upper">
            <path class="mascot__edge" d="M161 263L63 363" />
            <path class="mascot__base" d="M161 263L63 363" />
            <path class="mascot__suit" d="M148.3 276L85.6 340" />
          </g>
          <g ref="upREl" class="mascot__limb mascot__limb--upper">
            <path class="mascot__edge" d="M351 263L449 363" />
            <path class="mascot__base" d="M351 263L449 363" />
            <path class="mascot__suit" d="M363.7 276L426.5 340" />
          </g>

          <!-- Торс. -->
          <g
            style="stroke: var(--ink)"
            stroke-width="5"
            stroke-linejoin="round"
          >
            <path
              d="M192 226Q166 224 151 255L131 385Q130 427 170 453Q256 497 342 453Q382 427 381 385L361 255Q346 224 320 226L289 240H223Z"
              fill="#1c292c"
            />
            <!-- Жёлтые грудные панели. -->
            <path
              d="M194 244L247 256V436Q202 435 163 418L178 290Q183 256 194 244Z"
              style="fill: var(--accent)"
            />
            <path
              d="M318 244L265 256V436Q310 435 349 418L334 290Q329 256 318 244Z"
              style="fill: var(--accent)"
            />
            <!-- Линии мышц. -->
            <g fill="none" stroke="#A9A700" stroke-width="3">
              <path d="M185 323Q209 309 239 328" />
              <path d="M327 323Q303 309 273 328" />
              <path d="M183 363Q211 352 239 368" />
              <path d="M329 363Q301 352 273 368" />
              <path d="M203 402L240 410" />
              <path d="M309 402L272 410" />
            </g>
            <!-- Центральный шов. -->
            <path d="M256 254V435" fill="none" stroke-width="4" />
            <!-- Ремни наплечные. -->
            <path
              d="M194 233L213 239L235 429L216 430Z"
              fill="#574132"
              stroke-width="3"
            />
            <path
              d="M318 233L299 239L277 429L296 430Z"
              fill="#574132"
              stroke-width="3"
            />
            <!-- Заклёшки. -->
            <g fill="#C9D5DB" stroke-width="2.5">
              <rect x="211" y="301" width="17" height="23" rx="4" />
              <rect x="284" y="301" width="17" height="23" rx="4" />
              <rect x="220" y="381" width="16" height="22" rx="4" />
              <rect x="276" y="381" width="16" height="22" rx="4" />
            </g>
            <!-- Пояс с пряжкой. -->
            <path
              d="M165 421Q256 451 347 421L351 445Q256 479 161 445Z"
              fill="#4c382c"
            />
            <circle cx="256" cy="452" r="22" style="fill: var(--accent)" />
            <circle cx="256" cy="452" r="13" fill="#1b272a" stroke-width="3" />
            <path
              d="M251 443v18M261 443v18"
              fill="none"
              style="stroke: var(--accent)"
              stroke-width="3"
            />
          </g>

          <!-- Голова: маска с тёмными заплатками глаз. Внешняя группа —
               CSS-доводка после посадки, внутренняя — наклон от скрипта. -->
          <g class="mascot__head-wrap">
            <g ref="headEl" class="mascot__head">
              <path
                d="M256 42C198 42 173 77 174 133C171 193 201 231 256 248C311 231 341 193 338 133C339 77 314 42 256 42Z"
                style="fill: var(--accent); stroke: var(--ink)"
                stroke-width="6"
              />
              <path
                d="M198 106Q215 86 243 108Q256 138 238 184Q218 211 197 190Q180 162 186 133Q188 118 198 106Z"
                fill="#152124"
                style="stroke: var(--ink)"
                stroke-width="3"
              />
              <path
                d="M314 106Q297 86 269 108Q256 138 274 184Q294 211 315 190Q332 162 326 133Q324 118 314 106Z"
                fill="#152124"
                style="stroke: var(--ink)"
                stroke-width="3"
              />
              <g ref="eyesEl" fill="#fff">
                <path d="M195 154Q216 136 237 155Q217 151 199 163Z" />
                <path d="M317 154Q296 136 275 155Q295 151 313 163Z" />
              </g>
              <path
                d="M240 219Q256 225 272 219"
                fill="none"
                stroke="#B3B100"
                stroke-width="2.5"
              />
            </g>
          </g>

          <!-- Сердечко между кистями у груди: каноническая
               параметрическая кривая сердца (x=16sin³t,
               y=13cost−5cos2t−2cos3t−cos4t, 72 точки), строго
               симметричная относительно x=256; указательные и большие
               пальцы трассируют её контур (см. POSE.HEART). -->
          <path
            ref="heartEl"
            class="mascot__heart"
            d="M256.0 329.4L256.2 328.1L256.6 326.5L257.4 324.5L258.7 322.3L260.4 320.0L262.6 317.9L265.3 316.1L268.4 314.9L271.8 314.2L275.3 314.3L278.9 315.1L282.2 316.6L285.2 318.8L287.7 321.5L289.6 324.6L290.8 328.0L291.2 331.6L290.8 335.3L289.6 338.9L287.7 342.5L285.2 345.9L282.2 349.3L278.9 352.5L275.3 355.6L271.8 358.6L268.4 361.5L265.3 364.4L262.6 367.0L260.4 369.6L258.7 371.9L257.4 373.9L256.6 375.5L256.2 376.8L256.0 377.8L255.8 376.8L255.4 375.5L254.6 373.9L253.3 371.9L251.6 369.6L249.4 367.0L246.7 364.4L243.6 361.5L240.2 358.6L236.7 355.6L233.1 352.5L229.8 349.3L226.8 345.9L224.3 342.5L222.4 338.9L221.2 335.3L220.8 331.6L221.2 328.0L222.4 324.6L224.3 321.5L226.8 318.8L229.8 316.6L233.1 315.1L236.7 314.3L240.2 314.2L243.6 314.9L246.7 316.1L249.4 317.9L251.6 320.0L253.3 322.3L254.6 324.5L255.4 326.5L255.8 328.1Z"
          />

          <!-- Предплечья: рисуются перед торсом и головой. -->
          <g ref="lowLEl" class="mascot__limb mascot__limb--fore">
            <path class="mascot__edge" d="M63 363L213 360" />
            <path class="mascot__base" d="M63 363L213 360" />
          </g>
          <g ref="lowREl" class="mascot__limb mascot__limb--fore">
            <path class="mascot__edge" d="M449 363L299 360" />
            <path class="mascot__base" d="M449 363L299 360" />
          </g>

          <!-- Кисти: по пять пальцев единой ширины (сдвоенный штрих:
               кант + жёлтое), правая зеркальна левой. Разметка —
               финальная поза: пальцы касаются фигуры-сердца. -->
          <g ref="handLEl" class="mascot__hand" transform="translate(213 360)">
            <path
              data-finger="middle"
              class="m-digit m-digit--mid m-digit--ink"
              d="M-3 -28 C-6 -38 2 -43 9 -37 C13 -32 9 -27 3 -26"
            />
            <path
              data-finger="middle"
              class="m-digit m-digit--mid m-digit--suit"
              d="M-3 -28 C-6 -38 2 -43 9 -37 C13 -32 9 -27 3 -26"
            />
            <path
              data-finger="ring"
              class="m-digit m-digit--mid m-digit--ink"
              d="M7 -27 C5 -37 13 -40 19 -33 C22 -28 18 -24 13 -23"
            />
            <path
              data-finger="ring"
              class="m-digit m-digit--mid m-digit--suit"
              d="M7 -27 C5 -37 13 -40 19 -33 C22 -28 18 -24 13 -23"
            />
            <path
              data-finger="little"
              class="m-digit m-digit--mid m-digit--ink"
              d="M16 -20 C14 -29 21 -31 26 -25 C29 -20 25 -16 20 -16"
            />
            <path
              data-finger="little"
              class="m-digit m-digit--mid m-digit--suit"
              d="M16 -20 C14 -29 21 -31 26 -25 C29 -20 25 -16 20 -16"
            />
            <path
              class="m-glove"
              d="M-19 -13 Q-20 -31 -7 -36 Q10 -40 22 -23 Q29 -6 19 10 Q1 19 -18 9Z"
            />
            <path
              data-finger="index"
              class="m-digit m-digit--mid m-digit--ink"
              d="M9.6 -38.8 C12.6 -43 17.6 -46.2 22.7 -47.1 C27.5 -47.9 32.9 -46.5 36.7 -43.7"
            />
            <path
              data-finger="index"
              class="m-digit m-digit--mid m-digit--suit"
              d="M9.6 -38.8 C12.6 -43 17.6 -46.2 22.7 -47.1 C27.5 -47.9 32.9 -46.5 36.7 -43.7"
            />
            <path
              data-finger="thumb"
              class="m-digit m-digit--thumb m-digit--ink"
              d="M21.5 -8.3 C26 -4.2 30.9 -0.4 35.3 3.8 C38.8 7.2 42.4 11 44 15.6"
            />
            <path
              data-finger="thumb"
              class="m-digit m-digit--thumb m-digit--suit"
              d="M21.5 -8.3 C26 -4.2 30.9 -0.4 35.3 3.8 C38.8 7.2 42.4 11 44 15.6"
            />
          </g>
          <g
            ref="handREl"
            class="mascot__hand"
            transform="translate(299 360) scale(-1 1)"
          >
            <path
              data-finger="middle"
              class="m-digit m-digit--mid m-digit--ink"
              d="M-3 -28 C-6 -38 2 -43 9 -37 C13 -32 9 -27 3 -26"
            />
            <path
              data-finger="middle"
              class="m-digit m-digit--mid m-digit--suit"
              d="M-3 -28 C-6 -38 2 -43 9 -37 C13 -32 9 -27 3 -26"
            />
            <path
              data-finger="ring"
              class="m-digit m-digit--mid m-digit--ink"
              d="M7 -27 C5 -37 13 -40 19 -33 C22 -28 18 -24 13 -23"
            />
            <path
              data-finger="ring"
              class="m-digit m-digit--mid m-digit--suit"
              d="M7 -27 C5 -37 13 -40 19 -33 C22 -28 18 -24 13 -23"
            />
            <path
              data-finger="little"
              class="m-digit m-digit--mid m-digit--ink"
              d="M16 -20 C14 -29 21 -31 26 -25 C29 -20 25 -16 20 -16"
            />
            <path
              data-finger="little"
              class="m-digit m-digit--mid m-digit--suit"
              d="M16 -20 C14 -29 21 -31 26 -25 C29 -20 25 -16 20 -16"
            />
            <path
              class="m-glove"
              d="M-19 -13 Q-20 -31 -7 -36 Q10 -40 22 -23 Q29 -6 19 10 Q1 19 -18 9Z"
            />
            <path
              data-finger="index"
              class="m-digit m-digit--mid m-digit--ink"
              d="M9.6 -38.8 C12.6 -43 17.6 -46.2 22.7 -47.1 C27.5 -47.9 32.9 -46.5 36.7 -43.7"
            />
            <path
              data-finger="index"
              class="m-digit m-digit--mid m-digit--suit"
              d="M9.6 -38.8 C12.6 -43 17.6 -46.2 22.7 -47.1 C27.5 -47.9 32.9 -46.5 36.7 -43.7"
            />
            <path
              data-finger="thumb"
              class="m-digit m-digit--thumb m-digit--ink"
              d="M21.5 -8.3 C26 -4.2 30.9 -0.4 35.3 3.8 C38.8 7.2 42.4 11 44 15.6"
            />
            <path
              data-finger="thumb"
              class="m-digit m-digit--thumb m-digit--suit"
              d="M21.5 -8.3 C26 -4.2 30.9 -0.4 35.3 3.8 C38.8 7.2 42.4 11 44 15.6"
            />
          </g>
        </g>
      </svg>
    </div>
  </div>
</template>

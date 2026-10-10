# SEO Implementation Report — внедрение 2026-10-09

Стек: Nuxt 4.5 (SSR/Nitro), Vue 3.5, Node 24. Все изменения прошли
`format → lint → typecheck → unit (65/65) → build → e2e`
(см. SEO_TEST_REPORT.md). Бизнес-логика не менялась; дизайн-система и URL
сохранились.

## 1. Изменённые и добавленные файлы

### Новые

| Файл | Назначение |
| --- | --- |
| `shared/seo/site.ts` | единый источник SEO-констант: домен, punycode, INDEXABLE_ROUTES, `canonicalSiteUrl()` |
| `shared/seo/schema.ts` | билдеры JSON-LD: Organization, WebSite, Store, BreadcrumbList, `parseOpeningHours()` |
| `shared/analytics/metrika.ts` | резолвер загрузки Метрики, allowlist событий/параметров, `sanitizeEventParams()` |
| `app/utils/analytics.ts` | типобезопасный `trackEvent()` (reachGoal c санитайзером) |
| `app/plugins/yandex-metrika.client.ts` | единственная точка интеграции Метрики: загрузчик, init, SPA-хиты |
| `app/composables/useAgeConfirmed.ts` | общее состояние 18+ для layout и страниц |
| `server/routes/sitemap.xml.ts` | динамический sitemap (8 URL, punycode, без lastmod) |
| `public/yandex_637e4d2139cdf333.html` | файл подтверждения Яндекс Вебмастера |
| `scripts/seo-perf-measure.mjs` | лабораторный замер TTFB/LCP/CLS (мобильная эмуляция) |
| `tests/seo.spec.ts`, `tests/metrika.spec.ts`, `tests/seo-unit.test.mjs` | SEO-тесты (см. §7) |
| `SEO_*.md`, `YANDEX_*_SETUP.md` | отчёты этой итерации |

### Существенные изменения

| Файл | Что изменилось |
| --- | --- |
| `app/layouts/default.vue` | PUBLIC_ROUTES: добавлены `/`, `/about`, `/stores`, `/partners` (гейт не показывается; слот рендерится для роботов) |
| `app/pages/index.vue` | каталог-секции (категории/«Недавно обновлено»/бренды) скрыты до подтверждения 18+; index-метаданные; WebSite JSON-LD; preload LCP-изображения |
| `app/composables/usePageSeo.ts` | per-page robots (index/noindex), canonical (punycode), og:url/og:locale, BreadcrumbList |
| `app/pages/*` (8 страниц) | `index: true` + breadcrumbs; `/design-system` — явный noindex |
| `app/pages/catalog/[category].vue`, `app/pages/product/[slug].vue` | `definePageMeta.validate` → честный 404 без age-cookie (фикс мягких 404) |
| `app/app.vue` | Organization JSON-LD на всех страницах; noscript-пиксель Метрики (при активном счётчике) |
| `nuxt.config.ts` | CSP + `mc.yandex.ru` (script/img/connect); `runtimeConfig.public.siteUrl`, `metrikaEnabled`; нейтральные head-дефолты (страховочный noindex) |
| `public/robots.txt` | гранулярные правила + Sitemap (было `Disallow: /`) |
| `app/components/contacts/StoreMapCanvas.vue` | ленивая инициализация карты по IntersectionObserver (−706 КБ на первом экране /contacts) |
| `app/pages/about.vue` | `fetchpriority="high"` на LCP-изображении |
| `app/pages/privacy.vue` | политика ПД: cookie-перечень (+`prohook-session`, аналитика), п. 3.6 «Веб-аналитика», Яндекс в п. 4 |
| События аналитики | `StorePicker`, `StoresMapSection`, `stores.vue`, `contacts.vue`, `AppFooter`, `login.vue`, `register.vue`, `CatalogView` |
| `docs/COMPLIANCE.md` | Data Flow, сторонние сервисы, меры, чек-лист публикации — актуализированы |
| `eslint.config.mjs`, `playwright.config.ts`, `.env.example` | поддержка новых тестов/переменных |

## 2. Маршруты и метаданные

Индексируемые (`index, follow` + canonical + og:url + BreadcrumbList):
`/`, `/about`, `/stores`, `/contacts`, `/information`, `/partners`,
`/privacy`, `/personal-data`.
Noindex: `/catalog*`, `/product/*` (до юр. решения), `/search`,
`/reserve`, `/login`, `/register`, `/account`, `/design-system`, ошибки.
Единственность meta robots и значения — тестом (страховочный дефолт
`noindex, nofollow` в `nuxt.config.app.head` переопределяется страницей).

## 3. Sitemap и robots

- `/sitemap.xml` — 8 URL, `https://xn--j1ahceql.xn--p1ai/…`, без lastmod,
  без каталога/товаров (правовая классификация), кеш 1 ч.
- `/robots.txt` — Disallow: `/account`, `/login`, `/register`, `/reserve`,
  `/search`, `/design-system`, `/api/`, `/product/`; CSS/JS открыты;
  `Sitemap: https://xn--j1ahceql.xn--p1ai/sitemap.xml`.

## 4. Canonical и дубли

- Все canonical — абсолютные, punycode-хост, без query/hash
  (`canonicalSiteUrl`).
- Трейлинг-слэш и неизвестные пути → 404 (нет дублейCanonical-страниц);
  варианты с query схлопываются canonical'ом.
- Кириллица/punycode — одна машинная форма; www/HTTP-редиректы — уровень
  nginx (проверка — роадмап).

## 5. Структурированные данные

Organization (все страницы) + WebSite (главная) + BreadcrumbList (6
страниц) + Store ×30 (/stores; NAP/geo/часы). Product/Offer/Rating
отсутствуют by design (SEO_COMPLIANCE_AUDIT.md §3.4).

## 6. Производительность (лабораторно, до/после)

Методика: `scripts/seo-perf-measure.mjs` — Chromium, мобильная эмуляция
390×844 DPR3, **Slow 4G** (1,6 Мбит/с, RTT 150 мс), **CPU ×4**, медиана
из 3 прогонов, 8 с «прогрева» (вместо networkidle — карта грузится
непрерывно). Сервер — production-сборка на localhost (TTFB лабораторно
занижен — сравнение до/после корректно, абсолют — нет).

| Страница (бот-вид, если не указано) | LCP до | LCP после | CLS | Передано до | Передано после |
| --- | --- | --- | --- | --- | --- |
| `/` | 1,76 с | 1,80 с | 0,001 → 0 | 499 КБ | 456 КБ |
| `/` (18+ подтверждён) | 2,07 с | 1,80 с | 0 | 466 КБ | 475 КБ |
| `/contacts` | 1,79 с | 1,73 с | 0 | **1171 КБ** | **475 КБ (−706)** |
| `/stores` | 1,56 с | 1,65 с | 0,001 → 0 | 499 КБ | 481 КБ |
| `/about` | 1,59 с* | 2,57 с* | 0,001 → 0 | 499 КБ | 464 КБ |

\* `/about`, `/stores`, `/` в «до» для бота рендерили заглушку гейта —
LCP «до» измерен по пустой странице; «после» бот получает полный контент
(LCP-элемент `/about` — изображение 14 КБ; 2,57 с — лабораторный
worst-case Slow 4G + CPU×4, текстовый контент доступен на 1,7 с; в
полевых сетях ожидается < 2,5 с — мониторинг в роадмапе).

INP лабораторно не измеряется (нет стандартизированного lab-метода);
CLS ≤ 0,001 на всех страницах. Главный выигрыш — `/contacts`:
ленивая инициализация карты economит ~0,7 МБ на медленных сетях.

## 7. Production build

`npm run build` — успешно; общий размер серверного вывода 3,86 МБ
(1,1 МБ gzip). Прод-сервер проверен вручную: все статусы (включая 404
несуществующих категорий/товаров без age-cookie), sitemap/robots/
verification-файл — 200; canonical главной —
`https://xn--j1ahceql.xn--p1ai/`; метрика в auto-режиме на localhost не
грузится (0 упоминаний mc.yandex.ru в HTML).

## 8. Развёртывание

Изменения попадут на прод стандартным конвейером: push в `main` → CI
(format/lint/types/unit/build) → `prohook-deploy` на VPS 5.63.158.22.
После деплоя: файл Вебмастера доступен по
`https://прохук.рф/yandex_637e4d2139cdf333.html`, Метрика включится
автоматически (production + публичный домен), sitemap —
`https://прохук.рф/sitemap.xml`.

## 9. Что сознательно НЕ сделано (правовые ограничения)

- Не включена индексация каталога/карточек товаров (LEGAL REVIEW).
- Не созданы Product/Offer-разметка, товарные фиды, рекламные тексты,
  стимулирующие метаданные, «вкусовые» лендинги.
- Не реализованы ecommerce-события и purchase-воронки (покупки офлайн).
- `SearchAction` не добавлен (цель поиска закрыта от обхода).
- robots.txt не используется для «защиты» ПД (только noindex+auth).

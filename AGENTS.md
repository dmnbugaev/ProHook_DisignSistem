# AGENTS.md — инструкции для агентов

ProHook (прохук.рф) — справочный каталог товаров сети специализированных
магазинов (Саратов + Москва) на Nuxt 4 / Vue 3 / TypeScript. Данные товаров —
из МойСклад через серверный снимок. Это НЕ интернет-магазин: корзины, оплаты и
доставки нет ни в UI, ни в API; продажа только в магазине после проверки
возраста. Любое изменение, затрагивающее этот принцип, — юридически чувствительное.

## Команды

```sh
npm run dev                 # dev-сервер на 127.0.0.1:3000
npm run typecheck           # vue-tsc
npm run lint                # eslint --max-warnings 0
npm run format:check        # prettier — CI блокирует непроформатированное
npm run format              # исправить форматирование перед коммитом
npm run test:unit           # node --test tests/*.test.mjs
npm test                    # Playwright e2e (chromium + webkit)
npm run build               # production-сборка
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4317 npm test   # e2e против сборки
npx playwright test -c playwright.audit.config.ts    # аудит вёрстки (нужен build)
npm run catalog:sync        # полный снимок каталога из МойСклад
```

Node 24 (юнит-тесты тайминг-зависимы на Node 22 — ложные «Promise resolution
is still pending»). CI (.github/workflows/ci.yml) гоняет format → lint →
types → unit → build и деплоит на VPS после зелёного main.

## Структура и границы слоёв

- `app/` — клиент: `components/ui` (примитивы) → `layout`/`common`/`product`/
  `catalog`/`sections` (композиции), `composables/`, `pages/`, `plugins/`.
- `server/` — Nitro: `api/` (HTTP-контракт), `repositories/` (фильтрация
  снимка), `services/` (МойСклад, кэш, сессии, Тейка, капча), `data/`.
- `shared/` — общий код клиента и сервера: `types/`, `utils/`, `legal/`,
  `seo/`, `analytics/`, `content/`. Не тащить сюда ничего серверного.
- `tests/` — `*.spec.ts` (Playwright), `*.test.mjs` (node --test),
  `fixtures/catalog.json` — снимок для e2e; `tests/audit/*.audit.ts` —
  отдельный аудит-конфиг (свит 280–2560, touch 44×44, axe, консоль).
- `docs/` — COMPLIANCE.md, STORE-MAPPING.md, CONTENT-SOURCES.md, QA.md.

Секреты (МойСклад, Telegram, Тейка, серверный ключ SmartCaptcha) — только в
server-side runtime config / env. В клиентский бандл, DOM и логи они не
попадают; изображения товаров — только через серверный прокси
`/api/products/:id/images/:index`.

## Правила кода

- Язык проекта — русский: комментарии, коммиты, тексты UI.
- Pinia и Tailwind не вводились: глобальное состояние — `useState`/`useCookie`,
  стили — собственный CSS на токенах `app/assets/css/tokens.css`. Новые
  runtime-зависимости не добавлять без необходимости.
- Деньги — целые копейки внутри API, в URL-фильтрах — рубли. Наличие — enum
  `available | low | unavailable | unknown`, количества не публикуются.
- Фильтры/сортировки каталога синхронизированы с URL; неизвестная
  категория/товар — настоящий 404 (не мягкий).
- CSP и security-заголовки — в `nuxt.config.ts`: каждый новый внешний сервис
  (скрипт/картинки/connect) требует явного добавления хостов. Мандат
  владельца: только российские сервисы (Яндекс, 2ГИС; OSM/Nominatim под
  запретом).
- SEO: `noindex, nofollow` — дефолт из nuxt.config; индексируемые страницы
  включаются через `usePageSeo({ index: true })`. Канонический домен
  сериализуется в punycode в `shared/seo/site.ts`. Метрика 113582832 —
  `app/plugins/yandex-metrika.client.ts`, режим через `NUXT_PUBLIC_METRIKA_ENABLED`.

## Юридические рамки (менять аккуратно)

Подробности — `docs/COMPLIANCE.md`; читать перед правками возраста, legal,
форм, данных. Ключевое:

- Возрастной гейт: до подтверждения cookie контент каталога не рендерится
  даже в SSR-HTML. Совершеннолетие с аккаунта (дата рождения) — единственный
  источник доступа к изображениям товаров; cookie гейта — только декларация.
- Классификация ассортимента централизована в `shared/legal/classification.ts`:
  запрещённые и неклассифицированные категории не публикуются; новые корневые
  категории МойСклад по умолчанию скрыты.
- Формы (партнёрство, резерв) требуют раздельных согласий; уведомления —
  Telegram-боты с allowlist chat_id в env.
- Банковские реквизиты намеренно не публикуются и не хранятся в репозитории.

## Готчи

- Перед e2e убить оставшийся `nuxt dev` на порту 3000, иначе тесты бьют в
  реальный каталог.
- Playwright поднимает сервер с `MOYSKLAD_SNAPSHOT_PATH=tests/fixtures/catalog.json`
  и поднятыми порогами rate-limit; капча и Telegram в e2e отключены.
- Живые проверки форм (партнёрство/резерв) с реальной доставкой в Telegram —
  мандат владельца: тестовые заявки помечаются «ТЕСТ» (в имени/комментарии) и
  доставляются только аккаунту 6939112736. В тестовом окружении выставлять
  `NUXT_TELEGRAM_CHAT_ID` и `TELEGRAM_RESERVATION_CHAT_IDS` равными только
  этому chat_id — остальные аккаунты allowlist тестовые уведомления не
  получают; на проде с общим allowlist формы не тестировать.
- На открытых роутах (/login, /register) сабмит до гидрации Vue уходит
  нативным GET с паролем в URL — ждать `__vue_app__` на `#__nuxt`.
- МойСклад режет curl маскированным 415 независимо от заголовков — только
  Node fetch (паттерн в `scripts/mass-rename/lib.mjs`).
- zsh не делает word-splitting: непроцитированный `$VAR` ломает аргументы;
  батареи curl-запросов гонять через `bash -c`, ответы парсить `jq`
  (Nitro pretty-print с пробелом после `:` ломает grep).
- WebKit-тест «main pages fit» плавает при полном прогоне, стабилен в
  изоляции; на macOS WebKit не генерирует Tab-события как Chromium.
- Владелец правит файлы параллельно с агентом — при конфликте правок
  перечитать файл, не перезаписывать вслепую.

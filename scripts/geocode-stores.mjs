// Геокодирование адресов магазинов из shared/content/stores.ts.
//
//   npm run stores:geocode                        — провайдер по наличию ключа
//   npm run stores:geocode -- --provider yandex   — Геокодер Яндекса (HTTP API)
//   npm run stores:geocode -- --provider 2gis     — Catalog API 2ГИС
//   npm run stores:geocode -- --force             — перегеокодировать все точки
//   npm run stores:geocode -- --dry-run           — не писать store-coordinates.json
//
// По требованию владельца используются только российские сервисы: Яндекс
// (developer.tech.yandex.ru → «Геокодер HTTP API», ключ YANDEX_GEOCODER_API_KEY)
// и 2ГИС (dev.2gis.com, ключ TWOGIS_CATALOG_API_KEY). Без ключа скрипт
// останавливается с подсказкой — координаты не придумывает.
// Автоматически принимаются только однозначные результаты «номер дома в
// нужном городе». Спорные точки либо помечаются review (единственный
// кандидат, но с расхождением — например, адрес за границей города),
// либо выводятся списком для ручного уточнения и в sidecar не попадают.

import process from "node:process";
import { writeFile } from "node:fs/promises";
import { createJiti } from "jiti";

const sidecarUrl = new URL(
  "../shared/content/store-coordinates.json",
  import.meta.url,
);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const providerArg = args.includes("--provider")
  ? args[args.indexOf("--provider") + 1]
  : undefined;
const yandexKey = process.env.YANDEX_GEOCODER_API_KEY;
const twoGisKey = process.env.TWOGIS_CATALOG_API_KEY;
const provider =
  providerArg ?? (yandexKey ? "yandex" : twoGisKey ? "2gis" : undefined);

if (provider === "yandex" && !yandexKey) {
  console.error(
    "Провайдер yandex требует ключ Геокодера: задайте YANDEX_GEOCODER_API_KEY",
    "(бесплатный ключ: developer.tech.yandex.ru → «Геокодер HTTP API»).",
  );
  process.exit(1);
}
if (provider === "2gis" && !twoGisKey) {
  console.error(
    "Провайдер 2gis требует ключ Catalog API: задайте TWOGIS_CATALOG_API_KEY",
    "(бесплатный ключ: dev.2gis.com).",
  );
  process.exit(1);
}
if (!provider) {
  console.error(
    "Нужен ключ геокодера: YANDEX_GEOCODER_API_KEY (Яндекс) или",
    "TWOGIS_CATALOG_API_KEY (2ГИС). Геокодеры не из российских сервисов",
    "не используются.",
  );
  process.exit(1);
}

const { storeLocations, storeCities } = await createJiti(
  import.meta.url,
).import("../shared/content/stores.ts");
const existing = await createJiti(import.meta.url).import(
  "../shared/content/store-coordinates.json",
);

const cityName = Object.fromEntries(
  storeCities.map((city) => [city.id, city.name]),
);

// Допустимая зона результата по городу: [minLng, minLat, maxLng, maxLat].
// За границей кандидат отбрасывается (защита от «одноимённой улицы в
// другом городе Саратовской области»).
const cityBounds = {
  saratov: [45.8, 51.35, 46.3, 51.8],
  moscow: [36.9, 55.1, 38.1, 56.05],
};

// Адресные особенности конкретных точек: варианты запроса на каждый случай.
const queryVariants = {
  "saratov-stolypina-13": ["Проспект Столыпина, 13, Саратов"],
  "saratov-50-let-oktyabrya-89": ["Проспект 50 лет Октября, 89, Саратов"],
  "saratov-alekseevskaya-7b": ["Алексеевская улица, 7Б, Саратов"],
  "saratov-gornaya-340a": [
    "Большая Горная улица, 340А, Саратов",
    "Большая Горная, 340, Саратов",
  ],
  "saratov-ogorodnaya-144-2": ["Огородная улица, 144/2, Саратов"],
  "saratov-burovaya-25": ["Буровая улица, 25, Саратов"],
  "saratov-entuziastov-26": ["проспект Энтузиастов, 26, Саратов"],
  "saratov-entuziastov-54b": [
    "улица Энтузиастов, 54Б, Саратов",
    "улица Энтузиастов, 54, Саратов",
  ],
  "saratov-chapaeva-1-5": ["улица Чапаева, 1/5, Саратов"],
  "moscow-sombrero-yangelya": ["Варшавское шоссе, 152а, Москва"],
  "moscow-parkovy": ["3-я Парковая улица, 57, Москва"],
  "moscow-bobrovo": ["Крымская улица, 1, Боброво"],
};

const normalize = (value) => value.toLowerCase().replaceAll("ё", "е");
// «152а» может быть набрано латиницей в ответе геокодера — сравниваем
// без учёта похожих символов двух алфавитов.
const latinToCyrillic = {
  a: "а",
  b: "в",
  c: "с",
  e: "е",
  h: "н",
  k: "к",
  m: "м",
  o: "о",
  p: "р",
  t: "т",
  x: "х",
  y: "у",
};
const foldNumber = (value) =>
  normalize(value)
    .replaceAll(/[^0-9а-я/]/g, "")
    .replaceAll(/[abcehkmoptxy]/g, (ch) => latinToCyrillic[ch]);

const houseNumber = (address) => {
  const match = address.match(
    /(?:^|,\s*)(?:вл\.\s*)?([0-9]+[а-яa-z]?(?:\s*\/\s*[0-9]+[а-яa-z]?)?)\s*$/i,
  );
  return match ? match[1].replaceAll(/\s/g, "") : null;
};

const inBounds = (coordinates, bounds) =>
  coordinates[0] >= bounds[0] &&
  coordinates[1] >= bounds[1] &&
  coordinates[0] <= bounds[2] &&
  coordinates[1] <= bounds[3];

async function geocodeYandex(query) {
  const url = new URL("https://geocode-maps.yandex.ru/1.x/");
  url.searchParams.set("apikey", yandexKey);
  url.searchParams.set("geocode", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("lang", "ru_RU");
  url.searchParams.set("results", "5");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Геокодер Яндекса HTTP ${response.status}`);
  }
  const payload = await response.json();
  const members = payload.response?.GeoObjectCollection?.featureMember ?? [];
  return members.map(({ GeoObject: object }) => {
    const meta = object?.metaDataProperty?.GeocoderMetaData ?? {};
    const address = meta.Address ?? {};
    const [lon, lat] = String(object?.Point?.pos ?? "")
      .split(" ")
      .map(Number);
    const details = address.AddressDetails?.Country ?? {};
    const locality =
      details.AdministrativeArea?.SubAdministrativeArea?.Locality
        ?.LocalityName ??
      details.AdministrativeArea?.Locality?.LocalityName ??
      null;
    return {
      label: meta.text ?? address.formatted ?? "",
      coordinates:
        Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null,
      houseNumber: address.house ?? null,
      houseLevel: meta.kind === "house" || meta.precision === "exact",
      adminName: locality,
    };
  });
}

async function geocode2Gis(query) {
  const url = new URL("https://catalog.api.2gis.com/3.0/items/geocode");
  url.searchParams.set("q", query);
  url.searchParams.set(
    "fields",
    "items.point,items.full_address_name,items.adm_div",
  );
  url.searchParams.set("key", twoGisKey);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Catalog API HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.meta?.error) {
    throw new Error(
      `Catalog API: ${payload.meta.error.message ?? "ошибка запроса"}`,
    );
  }
  const items = payload.result?.items ?? [];
  return items.map((item) => ({
    label: item.full_address_name ?? item.name,
    coordinates: item.point ? [item.point.lon, item.point.lat] : null,
    houseNumber: houseNumber(item.address_name ?? item.full_address_name ?? ""),
    houseLevel: true,
    adminName: null,
    mapsUrl: `https://2gis.ru/geo/${item.id}`,
  }));
}

const geocode = provider === "2gis" ? geocode2Gis : geocodeYandex;

const result = force ? {} : { ...existing };
const needsReview = [];
const ambiguous = [];
const failed = [];
let updated = 0;

for (const store of storeLocations) {
  if (!force && result[store.id]?.coordinates) {
    console.log(
      `  = ${store.id}: координаты уже есть, пропускаю (--force чтобы обновить)`,
    );
    continue;
  }
  const bounds = cityBounds[store.cityId];
  const queries = queryVariants[store.id] ?? [
    `${store.address}, ${cityName[store.cityId]}`,
  ];
  const expected = houseNumber(store.address);
  const expectedFold = expected ? foldNumber(expected) : null;
  // Цифры без литеры корпуса: «340а» → «340». Совпадение только по ним
  // — повод для review, не для автоматического принятия.
  const expectedBase = expectedFold?.replaceAll(/[^0-9/]/g, "") ?? null;
  const candidates = [];
  let accepted = null;
  try {
    for (const query of queries) {
      for (const row of await geocode(query)) {
        if (!row.coordinates || !inBounds(row.coordinates, bounds)) {
          continue;
        }
        candidates.push(row);
        const fold = row.houseNumber ? foldNumber(row.houseNumber) : null;
        const cityMatch =
          row.adminName !== null &&
          normalize(row.adminName).includes(normalize(cityName[store.cityId]));
        if (!fold || fold !== expectedFold || !cityMatch) {
          continue;
        }
        // Предпочитаем контур здания «дому №N», а не POI внутри него.
        if (!accepted || (row.houseLevel && !accepted.houseLevel)) {
          accepted = { ...row, query, review: null };
        }
        if (accepted.houseLevel) {
          break;
        }
      }
      if (accepted?.houseLevel) {
        break;
      }
    }
  } catch (error) {
    failed.push({ store, reason: String(error) });
    console.error(`  ! ${store.id}: ошибка запроса — ${error}`);
    continue;
  }

  if (!accepted) {
    // Единственный кандидат с совпадением дома, но с расхождением
    // (не тот административный город — например, точки агломерации
    // в Энгельсе под группой «Саратов»). Дубли-POI у того же дома
    // схлопываются: побеждает контур здания.
    const reviewGroups = new Map();
    for (const row of candidates) {
      const fold = row.houseNumber ? foldNumber(row.houseNumber) : null;
      if (!fold) {
        continue;
      }
      const numberOk =
        fold === expectedFold ||
        (expectedBase !== null &&
          fold === expectedBase &&
          /[^0-9/]$/.test(expectedFold));
      const cityMatch =
        row.adminName !== null &&
        normalize(row.adminName).includes(normalize(cityName[store.cityId]));
      if (!numberOk || cityMatch) {
        continue;
      }
      const key = `${fold}|${normalize(row.adminName ?? "")}`;
      const prev = reviewGroups.get(key);
      if (!prev || (!prev.houseLevel && row.houseLevel)) {
        reviewGroups.set(key, row);
      }
    }
    if (reviewGroups.size === 1) {
      const [row] = reviewGroups.values();
      accepted = {
        ...row,
        query: queries[0],
        review: "город в ответе геокодера не совпадает с городом точки",
      };
    }
  }

  if (accepted) {
    result[store.id] = {
      coordinates: accepted.coordinates,
      source: provider,
      resolved: accepted.label,
      geocodedAt: new Date().toISOString().slice(0, 10),
      ...(accepted.review ? { review: true, reviewNote: accepted.review } : {}),
      ...(accepted.mapsUrl ? { mapsUrl: accepted.mapsUrl } : {}),
    };
    updated += 1;
    const flag = accepted.review ? "⚠" : "+";
    console.log(
      `  ${flag} ${store.id}: [${accepted.coordinates.join(", ")}] — ${accepted.label}`,
    );
    if (accepted.review) {
      needsReview.push(store);
    }
  } else {
    ambiguous.push({ store, expected, candidates });
    console.warn(
      `  ? ${store.id}: однозначного дома не найдено (ожидался номер «${expected}»), кандидатов в городе: ${candidates.length}`,
    );
  }
}

if (!dryRun) {
  await writeFile(sidecarUrl, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

console.log(
  `\nОбновлено: ${updated}. Нужен review: ${needsReview.length}. Неоднозначных: ${ambiguous.length}. Ошибок: ${failed.length}.`,
);
if (dryRun) {
  console.log("Dry-run: store-coordinates.json не изменён.");
}
if (needsReview.length > 0) {
  console.log(
    "\n⚠ Помечены review (единственный кандидат, но с расхождением):",
  );
  for (const store of needsReview) {
    console.log(
      `- ${store.name} (${cityName[store.cityId]}) — проверьте на карте`,
    );
  }
}
if (ambiguous.length > 0) {
  console.log("\nТребуют ручного уточнения (в sidecar не записаны):");
  for (const { store, expected, candidates } of ambiguous) {
    console.log(
      `- ${store.name} (${cityName[store.cityId]}), ожидался дом «${expected}»`,
    );
    for (const candidate of candidates.slice(0, 3)) {
      console.log(
        `    · ${candidate.label} [${candidate.coordinates?.join(", ")}]`,
      );
    }
  }
  process.exitCode = 2;
}

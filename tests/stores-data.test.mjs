import assert from "node:assert/strict";
import { test } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { storeLocations, storeCities } = await jiti.import(
  "../shared/content/stores.ts",
);
const { storeAddresses } = await jiti.import(
  "../server/data/store-addresses.ts",
);
const coordinates = await jiti.import(
  "../shared/content/store-coordinates.json",
);

const cityNames = Object.fromEntries(
  storeCities.map((city) => [city.id, city.name]),
);

test("публичный список: 30 точек — 25 Саратов, 2 Энгельс, 3 Москва", () => {
  assert.equal(storeLocations.length, 30);
  assert.equal(
    storeLocations.filter((store) => store.cityId === "saratov").length,
    25,
  );
  assert.equal(
    storeLocations.filter((store) => store.cityId === "engels").length,
    2,
  );
  assert.equal(
    storeLocations.filter((store) => store.cityId === "moscow").length,
    3,
  );
  assert.deepEqual(storeCities.map((city) => city.id).sort(), [
    "engels",
    "moscow",
    "saratov",
  ]);
});

test("у каждой точки заполнены id/name/address и валидный cityId", () => {
  const ids = new Set();
  for (const store of storeLocations) {
    assert.ok(store.id.length > 0, "пустой id");
    assert.ok(!ids.has(store.id), `дублирующийся id: ${store.id}`);
    ids.add(store.id);
    assert.ok(store.name.length > 0, `пустое name у ${store.id}`);
    assert.ok(store.address.length > 0, `пустой address у ${store.id}`);
    assert.ok(cityNames[store.cityId], `неизвестный cityId у ${store.id}`);
  }
});

test("адреса согласованы с учётным списком store-addresses.ts", () => {
  const publicAddresses = storeLocations.map((store) => store.address);
  for (const address of Object.values(storeAddresses)) {
    // Московские строки в учёте содержат суффикс «— Название, район».
    const street = address.split(" — ")[0].trim();
    const matched = publicAddresses.some(
      (candidate) =>
        candidate === street ||
        candidate.includes(street) ||
        street.includes(candidate),
    );
    assert.ok(
      matched,
      `адрес из учёта не найден в публичном списке: ${address}`,
    );
  }
});

test("координаты есть у заполненных точек и лежат в границах города", () => {
  const bounds = {
    saratov: [45.8, 51.35, 46.3, 51.8],
    engels: [46.0, 51.42, 46.2, 51.56],
    moscow: [36.9, 55.1, 38.1, 56.05],
  };
  let withCoordinates = 0;
  for (const store of storeLocations) {
    const geo = coordinates[store.id];
    if (!geo) {
      continue;
    }
    withCoordinates += 1;
    assert.ok(
      Array.isArray(geo.coordinates) && geo.coordinates.length === 2,
      `кривые координаты у ${store.id}`,
    );
    const [lng, lat] = geo.coordinates;
    assert.equal(
      typeof geo.source,
      "string",
      `нет источника координат у ${store.id}`,
    );
    const [minLng, minLat, maxLng, maxLat] = bounds[store.cityId];
    assert.ok(
      lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat,
      `координаты ${store.id} вне границ ${cityNames[store.cityId]}: ${lng}, ${lat}`,
    );
  }
  // 30 точек минус Огородная, 144/2 (адрес не геокодируется — см.
  // docs/STORE-MAPPING.md): все остальные должны иметь координаты.
  assert.ok(
    withCoordinates >= 29,
    `ожидаем не менее 29 точек с координатами, сейчас ${withCoordinates}`,
  );
});

test("в sidecar нет записей про несуществующие магазины", () => {
  const ids = new Set(storeLocations.map((store) => store.id));
  for (const id of Object.keys(coordinates)) {
    assert.ok(ids.has(id), `в sidecar лишний id: ${id}`);
  }
});

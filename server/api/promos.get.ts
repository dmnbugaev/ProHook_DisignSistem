import {
  listActivePromos,
  seedDemoPromosIfEmpty,
} from "../services/promo-store";

/**
 * Публичный список активных промо-карточек для блока на главной. Секция
 * рендерится после подтверждения 18+, но сам список не содержит
 * чувствительных данных — карточки готовит владелец через бота.
 */
export default defineEventHandler(async (event) => {
  await seedDemoPromosIfEmpty();
  const items = await listActivePromos();
  setHeader(
    event,
    "Cache-Control",
    "public, max-age=60, stale-while-revalidate=300",
  );
  return { items };
});

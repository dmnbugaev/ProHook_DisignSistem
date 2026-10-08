import { fetchProductImage } from "../../../../services/moysklad";
import { getCatalogSnapshot } from "../../../../services/catalog-cache";
import { canViewProductImages } from "../../../../utils/session";

export default defineEventHandler(async (event) => {
  // Серверный возрастной гейт: прямой URL изображения не открывается без
  // сессии совершеннолетнего пользователя (cookie гейта — не подтверждение).
  if (!(await canViewProductImages(event)))
    throw createError({ statusCode: 403, statusMessage: "Adults only" });
  const slug = getRouterParam(event, "slug") || "";
  const index = Number(getRouterParam(event, "index"));
  const catalog = await getCatalogSnapshot();
  const product = catalog.products.find((item) => item.id === slug);
  if (
    !product ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= product.images.length
  )
    throw createError({ statusCode: 404, statusMessage: "Image not found" });
  try {
    const response = await fetchProductImage(slug, index);
    setHeader(
      event,
      "Content-Type",
      response.headers.get("content-type") || "image/jpeg",
    );
    // Ответ зависит от сессии — общий кеш прокси не должен его захватывать.
    setHeader(
      event,
      "Cache-Control",
      "private, max-age=300, stale-while-revalidate=3600",
    );
    return Buffer.from(await response.arrayBuffer());
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Image unavailable" });
  }
});

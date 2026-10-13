import { fetchProductImage } from "../../../../services/moysklad";
import { getCatalogSnapshot } from "../../../../services/catalog-cache";
import { canViewProductImages } from "../../../../utils/session";

export default defineEventHandler(async (event) => {
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
  // Серверный возрастной гейт: изображения регулируемых товаров не
  // открываются без сессии совершеннолетнего пользователя (cookie гейта —
  // не подтверждение). Общедоступные товары (возрастное ограничение не
  // действует, решение владельца 13.10.2026) доступны всем.
  if (!product.agePublic && !(await canViewProductImages(event)))
    throw createError({ statusCode: 403, statusMessage: "Adults only" });
  try {
    const response = await fetchProductImage(slug, index);
    setHeader(
      event,
      "Content-Type",
      response.headers.get("content-type") || "image/jpeg",
    );
    if (product.agePublic) {
      // Ответ не зависит от сессии — можно кешировать публично.
      setHeader(
        event,
        "Cache-Control",
        "public, max-age=3600, stale-while-revalidate=86400",
      );
    } else {
      setHeader(
        event,
        "Cache-Control",
        "private, max-age=300, stale-while-revalidate=3600",
      );
    }
    return Buffer.from(await response.arrayBuffer());
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Image unavailable" });
  }
});

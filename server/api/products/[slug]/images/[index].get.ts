import { fetchProductImage } from "../../../../services/moysklad";
import { getCatalogSnapshot } from "../../../../services/catalog-cache";

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
  try {
    const response = await fetchProductImage(slug, index);
    setHeader(
      event,
      "Content-Type",
      response.headers.get("content-type") || "image/jpeg",
    );
    setHeader(
      event,
      "Cache-Control",
      "public, max-age=300, stale-while-revalidate=3600",
    );
    return Buffer.from(await response.arrayBuffer());
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Image unavailable" });
  }
});

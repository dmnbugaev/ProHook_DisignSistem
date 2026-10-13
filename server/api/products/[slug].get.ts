import { catalogRepository } from "../../repositories/catalog";
import { getSessionUser } from "../../utils/session";
import { hasAgeConfirmation } from "../../utils/age-gate";
import { restrictProductImages } from "../../utils/product-images";

export default defineEventHandler(async (event) => {
  const product = await catalogRepository.getProduct(
    getRouterParam(event, "slug") || "",
  );
  if (!product)
    throw createError({ statusCode: 404, statusMessage: "Product not found" });
  // Товар существует, но не общедоступен: до подтверждения 18+ отдаём 403
  // (не 404) — страница товара рендерирует блок подтверждения возраста.
  if (!hasAgeConfirmation(event) && !product.agePublic)
    throw createError({
      statusCode: 403,
      statusMessage: "Age confirmation required",
    });
  const user = await getSessionUser(event);
  if (user?.canViewProductImages || product.agePublic) return product;
  return restrictProductImages(product);
});

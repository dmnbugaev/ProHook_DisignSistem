import { catalogRepository } from "../../repositories/catalog";
import { getSessionUser } from "../../utils/session";
import { restrictProductImages } from "../../utils/product-images";

export default defineEventHandler(async (event) => {
  const product = await catalogRepository.getProduct(
    getRouterParam(event, "slug") || "",
  );
  if (!product)
    throw createError({ statusCode: 404, statusMessage: "Product not found" });
  const user = await getSessionUser(event);
  if (user?.canViewProductImages) return product;
  return restrictProductImages(product);
});

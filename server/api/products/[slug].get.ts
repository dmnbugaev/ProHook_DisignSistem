import { catalogRepository } from "../../repositories/catalog";
export default defineEventHandler(async (event) => {
  const product = await catalogRepository.getProduct(
    getRouterParam(event, "slug") || "",
  );
  if (!product)
    throw createError({ statusCode: 404, statusMessage: "Product not found" });
  return product;
});

import { catalogRepository } from "../../repositories/catalog";
import { getSessionUser } from "../../utils/session";
import { restrictMetaImages } from "../../utils/product-images";

export default defineEventHandler(async (event) => {
  const meta = await catalogRepository.getMeta();
  const user = await getSessionUser(event);
  if (user?.canViewProductImages) return meta;
  return restrictMetaImages(meta);
});

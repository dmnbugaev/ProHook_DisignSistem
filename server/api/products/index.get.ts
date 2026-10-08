import { parseCatalogQuery } from "../../../shared/utils/catalog-query";
import { catalogRepository } from "../../repositories/catalog";
import { getSessionUser } from "../../utils/session";
import { restrictProductListImages } from "../../utils/product-images";

export default defineEventHandler(async (event) => {
  const list = await catalogRepository.list(parseCatalogQuery(getQuery(event)));
  const user = await getSessionUser(event);
  if (user?.canViewProductImages) return list;
  return restrictProductListImages(list);
});

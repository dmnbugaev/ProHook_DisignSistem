import { parseCatalogQuery } from "../../../shared/utils/catalog-query";
import { catalogRepository } from "../../repositories/catalog";
import { getSessionUser } from "../../utils/session";
import { hasAgeConfirmation } from "../../utils/age-gate";
import { restrictProductListImages } from "../../utils/product-images";

export default defineEventHandler(async (event) => {
  // До подтверждения 18+ выдача ограничена общедоступным ассортиментом
  // (см. AGE_PUBLIC_ROOT_CATEGORIES) — totals и pageCount тоже.
  const list = await catalogRepository.list(
    parseCatalogQuery(getQuery(event)),
    {
      agePublicOnly: !hasAgeConfirmation(event),
    },
  );
  const user = await getSessionUser(event);
  if (user?.canViewProductImages) return list;
  return restrictProductListImages(list);
});

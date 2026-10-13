import { parseCatalogQuery } from "../../../shared/utils/catalog-query";
import { catalogRepository } from "../../repositories/catalog";
import { hasAgeConfirmation } from "../../utils/age-gate";

/**
 * Подсказки поиска: живые совпадения по названию/категории/артикулу,
 * пока пользователь печатает. Изображения не отдаются — в списке только
 * текст и цена; до подтверждения 18+ подсказки ограничены общедоступным
 * ассортиментом, названия регулируемых товаров не раскрываются.
 */
export default defineEventHandler(async (event) => {
  const query = parseCatalogQuery(getQuery(event));
  const items = await catalogRepository.suggest(query, 8, {
    agePublicOnly: !hasAgeConfirmation(event),
  });
  return { items };
});

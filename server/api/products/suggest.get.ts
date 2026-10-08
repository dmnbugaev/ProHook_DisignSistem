import { parseCatalogQuery } from "../../../shared/utils/catalog-query";
import { catalogRepository } from "../../repositories/catalog";

/**
 * Подсказки поиска: живые совпадения по названию/категории/артикулу,
 * пока пользователь печатает. Изображения не отдаются — в списке только
 * текст и цена, поэтому возрастное ограничение здесь не требуется.
 */
export default defineEventHandler(async (event) => {
  const query = parseCatalogQuery(getQuery(event));
  const items = await catalogRepository.suggest(query);
  return { items };
});

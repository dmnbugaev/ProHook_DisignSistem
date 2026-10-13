import { catalogRepository } from "../../repositories/catalog";
import { getSessionUser } from "../../utils/session";
import { restrictMetaImages } from "../../utils/product-images";

export default defineEventHandler(async (event) => {
  const meta = await catalogRepository.getMeta();
  const user = await getSessionUser(event);
  if (user?.canViewProductImages) return meta;
  // Обложки остаются только у общедоступных категорий: их изображения
  // не ограничены по возрасту. Состав категорий не фильтруется по
  // подтверждению 18+ — навигация регулируемых категорий нужна странице
  // каталога для блока подтверждения, товары отдаёт /api/products.
  return restrictMetaImages(meta);
});

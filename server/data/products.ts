import type { Product } from "../../shared/types/product";
import { catalogMeta } from "./catalog";
// Fictional, non-commercial objects for a portfolio demonstration.
const series = [
  {
    name: "Подставка",
    category: "stands",
    material: "Алюминий",
    image: "object",
    base: 1200,
  },
  {
    name: "Органайзер",
    category: "organizers",
    material: "Керамика",
    image: "organizer",
    base: 2400,
  },
  {
    name: "Чехол",
    category: "cases",
    material: "Текстиль",
    image: "accessory",
    base: 800,
  },
  {
    name: "Блокнот",
    category: "notebooks",
    material: "Бумага",
    image: "notebook",
    base: 600,
  },
];
export const products: Product[] = Array.from({ length: 28 }, (_, index) => {
  const item = series[index % series.length]!;
  const number = String(Math.floor(index / series.length) + 1).padStart(2, "0");
  const name = `${item.name} ${number}`;
  const basePrice = (item.base + Math.floor(index / 4) * 200) * 100;
  return {
    id: `product-${index + 1}`,
    slug: `${item.category}-${number}`,
    sku: `DEMO-${String(index + 1).padStart(3, "0")}`,
    name,
    brand: catalogMeta.brands[index % catalogMeta.brands.length]!,
    categoryId: item.category,
    images:
      index === 27
        ? []
        : [
            {
              id: "main",
              src: `/demo/${item.image}.svg`,
              alt: `${name} — условная иллюстрация`,
            },
            ...(index % 3 === 0
              ? [
                  {
                    id: "detail",
                    src: "/demo/detail.svg",
                    alt: `${name} — деталь формы`,
                  },
                ]
              : []),
          ],
    description: `${name} из демонстрационной коллекции. Простая геометрия и продуманные пропорции. Условный предмет показывает, как в каталоге выглядят описание, изображения, характеристики и предложения разных магазинов.`,
    attributes: [
      { code: "material", name: "Материал", value: item.material },
      { code: "color", name: "Цвет", value: index % 2 ? "Чёрный" : "Светлый" },
      { code: "collection", name: "Коллекция", value: "Основы" },
    ],
    offers: catalogMeta.stores.map((store, storeIndex) => ({
      storeId: store.id,
      currency: "RUB",
      price: basePrice + storeIndex * 15000,
      availability:
        (index + storeIndex) % 7 === 0
          ? "unavailable"
          : (index + storeIndex) % 4 === 0
            ? "low"
            : "available",
    })),
    legalClass: "UNREGULATED",
    publishedAt: `2026-09-${String(index + 1).padStart(2, "0")}T12:00:00Z`,
  };
});

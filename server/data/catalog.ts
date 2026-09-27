import type { CatalogMeta } from "../../shared/types/catalog";
export const catalogMeta: CatalogMeta = {
  cities: [
    { id: "city-1", name: "Город А" },
    { id: "city-2", name: "Город Б" },
  ],
  stores: [
    {
      id: "store-1",
      cityId: "city-1",
      name: "Студия · Центр",
      description: "Демонстрационная точка в центре города.",
    },
    {
      id: "store-2",
      cityId: "city-1",
      name: "Студия · Север",
      description: "Вторая точка для сравнения цен и наличия.",
    },
    {
      id: "store-3",
      cityId: "city-2",
      name: "Студия · Парк",
      description: "Демонстрационная точка в другом городе.",
    },
  ],
  brands: [
    { id: "brand-form", name: "ФОРМА", slug: "forma" },
    { id: "brand-line", name: "ЛИНИЯ", slug: "liniya" },
    { id: "brand-module", name: "МОДУЛЬ", slug: "modul" },
  ],
  categories: [
    {
      id: "objects",
      name: "Объекты",
      slug: "objects",
      description: "Лаконичные предметы для пространства.",
      parentId: null,
      image: "/demo/object.svg",
    },
    {
      id: "accessories",
      name: "Аксессуары",
      slug: "accessories",
      description: "Детали, которые всегда с собой.",
      parentId: null,
      image: "/demo/accessory.svg",
    },
    {
      id: "stationery",
      name: "Канцелярия",
      slug: "stationery",
      description: "Всё для идей и ежедневных записей.",
      parentId: null,
      image: "/demo/notebook.svg",
    },
    {
      id: "stands",
      name: "Подставки",
      slug: "stands",
      description: "Геометричные подставки для рабочего стола.",
      parentId: "objects",
    },
    {
      id: "organizers",
      name: "Органайзеры",
      slug: "organizers",
      description: "Место для каждой небольшой вещи.",
      parentId: "objects",
    },
    {
      id: "cases",
      name: "Чехлы",
      slug: "cases",
      description: "Простая форма для нужных мелочей.",
      parentId: "accessories",
    },
    {
      id: "notebooks",
      name: "Блокноты",
      slug: "notebooks",
      description: "Чистый лист для следующей идеи.",
      parentId: "stationery",
    },
  ],
  materials: ["Алюминий", "Текстиль", "Бумага", "Керамика"],
};

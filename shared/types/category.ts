export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId: string | null;
  image?: string;
  /**
   * Количество публикуемых товаров в категории, включая все подкатегории.
   * Считается при сборке снимка; в фикстурах может отсутствовать.
   */
  productCount?: number;
  /**
   * Категория общедоступна: видна в навигации каталога до подтверждения
   * 18+ (наследуется от корневой категории, см. AGE_PUBLIC_ROOT_CATEGORIES).
   */
  agePublic: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId: string | null;
  image?: string;
  /**
   * Категория общедоступна: видна в навигации каталога до подтверждения
   * 18+ (наследуется от корневой категории, см. AGE_PUBLIC_ROOT_CATEGORIES).
   */
  agePublic: boolean;
}

/**
 * Юридическая классификация ассортимента (централизованный слой).
 *
 * Класс определяется по КОРНЕВОЙ категории МойСклад: подкаталоги наследуют
 * класс корня. Категории с неизвестным корнем не публикуются до явной
 * классификации здесь (LEGAL REVIEW REQUIRED) — новый ассортимент из МойСклад
 * не должен автоматически попадать на сайт.
 *
 * Основания (редакции на 30.09.2026):
 * - 15-ФЗ ст. 16, 19, 20 — запрет рекламы и стимулирования продаж табачной и
 *   никотинсодержащей продукции и устройств, запрет дистанционной продажи;
 * - 38-ФЗ ст. 7 — запрет рекламы табака, никотинсодержащей продукции,
 *   устройств и курительных принадлежностей;
 * - 365-ФЗ — с 01.03.2025 запрет оборота НСП с нембачными вкусовыми добавками
 *   (вопрос о фактическом ассортименте открыт — см. docs/COMPLIANCE.md);
 * - закон Саратовской области — запрет продажи ЭСДН и жидкостей с 01.03.2027
 *   (см. shared/legal/regional-restrictions.ts).
 */
export type LegalClass =
  | "REGULATED_NICOTINE"
  | "REGULATED_POUCH"
  | "REGULATED_DEVICE"
  | "REGULATED_TOBACCO"
  | "REGULATED_HOOKAH"
  | "ACCESSORY"
  | "UNREGULATED"
  | "PENDING_REVIEW"
  | "BANNED_FROM_SITE";

export interface LegalClassPolicy {
  /** Товары класса публикуются в каталоге. */
  publishProducts: boolean;
  /** Категории класса публикуются в навигации каталога. */
  publishCategories: boolean;
  /**
   * Свободные текстовые описания публикуются. Для регулируемых классов
   * публикуются только название и характеристики (нейтральная справка),
   * чтобы описания с рекламной лексикой не попадали на сайт.
   */
  publishDescription: boolean;
}

export const LEGAL_CLASS_POLICIES: Record<LegalClass, LegalClassPolicy> = {
  REGULATED_NICOTINE: {
    publishProducts: true,
    publishCategories: true,
    publishDescription: false,
  },
  // Безтабачные никотиновые паучи (подтверждено владельцем 05.10.2026):
  // оборот разрешён, режим никотинсодержащей продукции (18+, запрет
  // дистанционной продажи, рекламы и стимулирования, маркировка).
  REGULATED_POUCH: {
    publishProducts: true,
    publishCategories: true,
    publishDescription: false,
  },
  REGULATED_DEVICE: {
    publishProducts: true,
    publishCategories: true,
    publishDescription: false,
  },
  REGULATED_TOBACCO: {
    publishProducts: true,
    publishCategories: true,
    publishDescription: false,
  },
  REGULATED_HOOKAH: {
    publishProducts: true,
    publishCategories: true,
    publishDescription: false,
  },
  ACCESSORY: {
    publishProducts: true,
    publishCategories: true,
    publishDescription: true,
  },
  UNREGULATED: {
    publishProducts: true,
    publishCategories: true,
    publishDescription: true,
  },
  // LEGAL REVIEW REQUIRED: класс не определён — не публикуется.
  PENDING_REVIEW: {
    publishProducts: false,
    publishCategories: false,
    publishDescription: false,
  },
  // Оборот запрещён или публикация запрещена решением владельца.
  BANNED_FROM_SITE: {
    publishProducts: false,
    publishCategories: false,
    publishDescription: false,
  },
};

/**
 * Корневые категории МойСклад → юридический класс.
 * Регистр и лишние пробелы не важны.
 */
export const ROOT_CATEGORY_CLASSES: Record<string, LegalClass> = {
  "одноразовые эс": "REGULATED_NICOTINE",
  жидкости: "REGULATED_NICOTINE",
  "предзаправленные картриджи": "REGULATED_NICOTINE",
  "картриджи и испарители": "REGULATED_DEVICE",
  устройства: "REGULATED_DEVICE",
  "табак для кальяна": "REGULATED_TOBACCO",
  "системы нагревания табака": "REGULATED_TOBACCO",
  кальяны: "REGULATED_HOOKAH",
  глицерин: "ACCESSORY",
  зажигалки: "UNREGULATED",
  напитки: "UNREGULATED",
  снеки: "UNREGULATED",
  "лапша быстрого приготовления": "UNREGULATED",
  "китайский чай": "UNREGULATED",
  другое: "UNREGULATED",
  // LEGAL REVIEW REQUIRED: природа товаров (пищевые концентраты или
  // компоненты никотинсодержащей продукции) не подтверждена владельцем.
  ароматизаторы: "PENDING_REVIEW",
  // По подтверждению владельца (05.10.2026) категория содержит БЕЗТАБАЧНЫЕ
  // никотиновые паучи, а не снюс (сосательный табак, оборот которого
  // запрещён ст. 19 15-ФЗ). Класс REGULATED_POUCH. LEGAL REVIEW REQUIRED:
  // (а) подтвердить отсутствие табака в составе каждой позиции — если
  // часть SKU является снюсом/жевательным табаком, её оборот запрещён и её
  // нужно исключить в МойСклад или разнести по разным категориям;
  // (б) вкусовые добавки в паучах после 01.03.2025 (365-ФЗ).
  // Имя корневой категории в МойСклад сохранено учётным («Жевательный
  // табак»); при переименовании в МойСклад обновить ключ ниже.
  "жевательный табак": "REGULATED_POUCH",
  // Витрина сигарет в интернете несёт высокий риск квалификации как реклама
  // (38-ФЗ ст. 7). Решение владельца: скрыть.
  сигареты: "BANNED_FROM_SITE",
  // Природа категории не подтверждена владельцем. Решение владельца: скрыть.
  нбс: "BANNED_FROM_SITE",
};

export function classifyRootCategory(name: string | undefined): LegalClass {
  const key = (name ?? "").trim().toLocaleLowerCase("ru").replace(/\s+/g, " ");
  return ROOT_CATEGORY_CLASSES[key] ?? "PENDING_REVIEW";
}

import type { LegalClass } from "./classification";

/**
 * Региональные ограничения розничной продажи (действуют и на публикацию
 * ассортимента для магазинов региона). Дата вступления проверяется в рантайме,
 * ограничение активируется автоматически.
 */
export interface RegionalRestriction {
  /**
   * Ключи регионов (совпадают с cityId каталога). Энгельс — отдельный
   * cityId, но тот же субъект: закон Саратовской области действует и там.
   */
  regions: string[];
  /** Классы, розничная продажа которых в регионе запрещена. */
  bannedClasses: LegalClass[];
  /** ISO-дата вступления ограничения в силу. */
  effectiveFrom: string;
  /** Основание для отображения пользователю и журнала соответствия. */
  note: string;
}

export const REGIONAL_RESTRICTIONS: RegionalRestriction[] = [
  {
    regions: ["saratov", "engels"],
    // Закон запрещает ЭСДН и жидкости для них. Безтабачные паучи
    // (REGULATED_POUCH) не входят в предмет запрета — LEGAL REVIEW REQUIRED:
    // сверить формулировку закона области о распространении на иную
    // никотинсодержащую продукцию при вступлении в силу.
    bannedClasses: ["REGULATED_NICOTINE", "REGULATED_DEVICE"],
    effectiveFrom: "2027-03-01",
    note: "Закон Саратовской области: запрет розничной продажи ЭСДН и жидкостей для них с 01.03.2027 сроком на 5 лет.",
  },
  // Москва: ограничений на дату среза 30.09.2026 нет. Регион может ввести
  // запрет до 01.03.2032 (изменения в 15-ФЗ 2026 г.) — отслеживать
  // региональные законы и дополнять этот список (см. docs/COMPLIANCE.md).
];

export function activeRestrictionFor(
  cityId: string | undefined,
  now: Date = new Date(),
): RegionalRestriction | undefined {
  if (!cityId) return undefined;
  return REGIONAL_RESTRICTIONS.find(
    (item) =>
      item.regions.includes(cityId) &&
      now.getTime() >= Date.parse(item.effectiveFrom),
  );
}

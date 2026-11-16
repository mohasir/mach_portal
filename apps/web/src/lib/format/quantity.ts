export interface QuantityUnit {
  name: string;
  pluralName: string;
  code: string;
}

// Unit names are stored capitalized ("Persona"); inside a sentence they read in lowercase. Only the
// first letter changes, so acronyms in a custom name survive ("Pack XL" -> "pack XL").
const lowerFirst = (text: string) => text.charAt(0).toLocaleLowerCase() + text.slice(1);

/**
 * The unit's name as it reads next to `quantity`: singular only for exactly 1, in Spanish and
 * English alike. Without a quantity it is the plural ("según la cantidad, en horas").
 */
export function unitNoun(unit: Pick<QuantityUnit, 'name' | 'pluralName'>, quantity?: number) {
  return lowerFirst(quantity === 1 ? unit.name : unit.pluralName);
}

/** "1 persona", "40 personas", "0 personas" (`name`) or "5 kg" (`code`, never pluralized). */
export function formatQuantity(
  quantity: number,
  unit: QuantityUnit,
  mode: 'name' | 'code' = 'name',
): string {
  if (mode === 'code') return `${quantity} ${unit.code}`;
  return `${quantity} ${unitNoun(unit, quantity)}`;
}

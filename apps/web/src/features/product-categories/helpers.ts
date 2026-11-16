/** A category with products can only be deactivated; the API rejects deleting it. */
export const canDeleteCategory = (category: { productCount: number }) =>
  category.productCount === 0;

/**
 * Options of the category select: the active categories plus `current` (a category the product
 * keeps although it was deactivated) when missing.
 */
export function categoryOptions<T extends { id: string; name: string }>(
  categories: readonly T[],
  current?: T | null,
): { value: string; label: string }[] {
  const all =
    current && !categories.some((c) => c.id === current.id) ? [...categories, current] : categories;
  return all.map((c) => ({ value: c.id, label: c.name }));
}

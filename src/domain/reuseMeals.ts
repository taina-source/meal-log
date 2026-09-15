import type { MealEntry } from './types';
export type SavedMealKind = 'chatgptMeal' | 'manualMeal';
export function savedMealKind(meal: MealEntry): SavedMealKind | null {
  if (meal.sourceType === 'chatgpt') return 'chatgptMeal';
  if (meal.sourceType === 'manual' && !meal.sourceId && !meal.setId && !meal.setRunId && !meal.recipeSnapshot && !meal.restaurantId && !meal.restaurantOrderId && !meal.restaurantSnapshot && !meal.chatgptSnapshot) return 'manualMeal';
  return null;
}
export function savedMealHistory(meals: MealEntry[], kind: SavedMealKind) {
  const groups = new Map<string, MealEntry[]>();
  const sorted = [...meals].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  for (const meal of sorted) {
    if (savedMealKind(meal) !== kind) continue;
    const key = kind === 'chatgptMeal' && meal.chatgptImportId ? `group:${meal.chatgptImportId}` : `meal:${meal.id}`;
    const group = groups.get(key) ?? []; group.push(meal); groups.set(key, group);
  }
  return [...groups].map(([id, entries]) => ({ id, entries }));
}

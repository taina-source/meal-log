import type { MealEntry } from './types';
import type { RecentItem } from './catalog';
import { setTotal } from './foods';
export function recentItems(meals: MealEntry[], now = Date.now()): RecentItem[] {
  const result = new Map<string, RecentItem>();
  const seenRuns = new Set<string>();
  for (const meal of [...meals].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    if (meal.setRunId) { if (seenRuns.has(meal.setRunId)) continue; seenRuns.add(meal.setRunId); }
    const kind = meal.setId ? 'set' : meal.sourceType === 'database' ? 'food' : meal.sourceType === 'recipe' ? 'recipe' : undefined;
    const sourceId = meal.setId ?? meal.sourceId;
    if (!kind || !sourceId) continue;
    const key = `${kind}:${sourceId}`;
    const previous = result.get(key);
    const ageDays = Math.max(0, (now - Date.parse(meal.createdAt)) / 86400000);
    const score = 1 / (1 + ageDays / 7);
    if (previous) { previous.count++; previous.score += score; continue; }
    const itemFromMeal = (entry: MealEntry) => ({ id: entry.id, kind: entry.sourceType === 'recipe' ? 'recipe' as const : 'food' as const, sourceId: entry.sourceId ?? '', name: entry.name, quantity: entry.quantity ?? 1, unit: entry.unit ?? 'g' as const, nutrients: { calories: entry.calories, protein: entry.protein, fat: entry.fat, carbs: entry.carbs }, notes: entry.notes, sourceVersion: entry.sourceVersion, recipeSnapshot: entry.recipeSnapshot });
    const setItems = kind === 'set' && meal.setRunId ? meals.filter(entry => entry.setRunId === meal.setRunId).map(itemFromMeal) : [];
    result.set(key, { kind, sourceId, name: meal.setName ?? meal.name, quantity: meal.setId ? 1 : meal.quantity ?? 1, count: 1, score, lastUsedAt: meal.createdAt, item: kind === 'set' ? undefined : itemFromMeal(meal), setSnapshot: setItems.length ? { id: sourceId, name: meal.setName ?? meal.name, items: setItems, total: setTotal(setItems), createdAt: meal.createdAt, updatedAt: meal.createdAt } : undefined });
  }
  return [...result.values()].sort((a, b) => b.score - a.score || b.lastUsedAt.localeCompare(a.lastUsedAt)).slice(0, 30);
}

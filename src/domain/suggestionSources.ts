import type { Favorite, Food, MealSet, MealSetItem, Recipe, RestaurantMenuItem } from './catalog';
import type { MealEntry } from './types';
import { discreteGrams, validCandidate, type SuggestionPart } from './suggestions';
import { foodItem, recipeItem, scaleNutrients, setTotal } from './foods';
import { recentItems } from './recents';
import { savedMealHistory } from './reuseMeals';
import { completeNutrients, isComplete } from './restaurantMenus';
export type SuggestionSource = { kind: 'catalog'; item: MealSetItem } | { kind: 'set'; set: MealSet } | { kind: 'saved'; meal: MealEntry } | { kind: 'restaurant'; item: RestaurantMenuItem };
export interface SourcePart extends SuggestionPart { source: SuggestionSource; set?: Pick<MealSet, 'id' | 'name'> }
export function catalogPart(item: MealSetItem, favorite = false, recent = false, preferred = false): SourcePart {
  return { id: `${item.kind}:${item.sourceId}:${item.quantity}`, sourceKey: `${item.kind}:${item.sourceId}`, name: item.name, quantity: item.quantity, unitLabel: item.unit === 'g' ? 'g' : '（料理全体に対する割合）', nutrients: item.nutrients, favorite, recent, prepared: item.kind === 'recipe', preferred, source: { kind: 'catalog', item } };
}
function setPart(set: MealSet, favorite: boolean, recent: boolean): SourcePart {
  return { id: `set:${set.id}:1`, sourceKey: `set:${set.id}`, name: set.name, quantity: 1, unitLabel: 'セット', nutrients: setTotal(set.items), favorite, recent, prepared: true, preferred: true, source: { kind: 'set', set } };
}
function savedPart(meal: MealEntry, favorite: boolean, recent: boolean): SourcePart {
  return { id: `saved:${meal.id}`, sourceKey: `saved:${meal.id}`, name: meal.name, quantity: meal.quantity ?? 1, unitLabel: meal.chatgptUnit ?? (meal.unit === 'g' ? 'g' : meal.unit === 'item' ? '個' : '回の保存量'), nutrients: { calories: meal.calories, protein: meal.protein, fat: meal.fat, carbs: meal.carbs }, favorite, recent, prepared: false, preferred: true, source: { kind: 'saved', meal } };
}
export function normalSources(foods: Food[], recipes: Recipe[], sets: MealSet[], favorites: Favorite[], meals: MealEntry[], now: number): SourcePart[] {
  const parts = new Map<string, SourcePart>();
  const add = (p: SourcePart) => { if (!validCandidate(p.nutrients)) return; const old = parts.get(p.id); if (!old || p.favorite || (!old.favorite && p.recent)) parts.set(p.id, { ...p, favorite: p.favorite || !!old?.favorite, recent: p.recent || !!old?.recent }); };
  const recent = recentItems([...meals].sort((a,b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)), now);
  const hasFavorite = (kind: string, id: string, quantity?: number) => favorites.some(f => f.kind === kind && f.sourceId === id && (quantity === undefined || f.quantity === quantity));
  const isRecent = (kind: string, id: string) => recent.some(r => r.kind === kind && r.sourceId === id);
  for (const food of foods) {
    // Do not turn unknown/null catalogue values into automatic suggestions.
    if (!validCandidate({ calories: food.caloriesPer100g, protein: food.proteinPer100g, fat: food.fatPer100g, carbs: food.carbsPer100g }) || Object.values(food.status).includes('missing')) continue;
    const prior = recent.find(r => r.kind === 'food' && r.sourceId === food.id);
    const amounts = new Set([...discreteGrams(prior?.quantity), ...favorites.filter(f => f.kind === 'food' && f.sourceId === food.id).map(f => f.quantity)]);
    for (const grams of amounts) { if (!(grams > 0 && grams <= 10000 && Number.isFinite(grams))) continue; add(catalogPart(foodItem(food, grams, food.id), hasFavorite('food', food.id, grams), !!prior, grams === prior?.quantity)); }
  }
  for (const recipe of recipes) {
    if (!(recipe.servings > 0)) continue;
    const fractions = new Set([1 / recipe.servings, .5, 1 / 3, .25, ...favorites.filter(f => f.kind === 'recipe' && f.sourceId === recipe.id).map(f => f.quantity)]);
    for (const fraction of fractions) if (fraction > 0 && fraction <= 100 && Number.isFinite(fraction)) add(catalogPart(recipeItem(recipe, fraction, recipe.id), hasFavorite('recipe', recipe.id, fraction), isRecent('recipe', recipe.id), fraction === 1 / recipe.servings));
  }
  for (const set of sets) if (set.items.length && set.items.every(i => validCandidate(i.nutrients))) add(setPart(set, hasFavorite('set', set.id), isRecent('set', set.id)));
  // Recent recipe/set snapshots, including deleted originals, keep the previously saved values.
  for (const r of recent) {
    if (r.item && (r.item.kind === 'food' || r.item.kind === 'recipe')) add(catalogPart(r.item, hasFavorite(r.kind, r.sourceId, r.quantity), true, true));
    if (r.setSnapshot && r.setSnapshot.items.every(i => validCandidate(i.nutrients))) add(setPart(r.setSnapshot, hasFavorite('set', r.sourceId), true));
  }
  for (const kind of ['manualMeal', 'chatgptMeal'] as const) for (const group of savedMealHistory(meals, kind).slice(0, 30)) for (const meal of group.entries) add(savedPart(meal, false, true));
  for (const f of favorites) if ((f.kind === 'manualMeal' || f.kind === 'chatgptMeal') && f.mealSnapshot) add(savedPart(f.mealSnapshot, true, parts.has(`saved:${f.mealSnapshot.id}`)));
  return [...parts.values()].sort((a,b) => a.id.localeCompare(b.id));
}
export function restaurantSources(items: RestaurantMenuItem[]): SourcePart[] {
  return items.filter(item => isComplete(item) && validCandidate(item)).map(item => ({ id: `restaurant:${item.id}`, sourceKey: `restaurant:${item.id}`, name: item.name, quantity: 1, unitLabel: item.quantityUnit ?? '商品', nutrients: completeNutrients(item), favorite: false, recent: false, prepared: true, preferred: true, source: { kind: 'restaurant', item } }));
}
export function editablePart(part: SourcePart, quantity: number): SourcePart {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) throw new Error('量は0より大きく10,000以下で入力してください。');
  if (part.source.kind === 'set' && quantity !== 1) throw new Error('セットの量は各構成品から変更してください。');
  if (part.source.kind === 'catalog' && part.source.item.kind === 'recipe' && quantity > 100) throw new Error('料理全体に対する割合は100以下で入力してください。');
  if (part.source.kind === 'restaurant' && (!Number.isInteger(quantity) || quantity > 99)) throw new Error('数量は1〜99の整数で入力してください。');
  if (part.unitLabel === '個' && !Number.isInteger(quantity)) throw new Error('個数は整数で入力してください。');
  return { ...part, quantity, nutrients: scaleNutrients(part.nutrients, quantity / part.quantity) };
}
// Set contents are edited individually; their original quantities and source snapshots are retained.
export function expandForReview(parts: SourcePart[]): SourcePart[] {
  return parts.flatMap(part => { if (part.source.kind !== 'set') return [part]; const set = part.source.set; return set.items.map((item, i) => ({ ...catalogPart(item, part.favorite, part.recent, true), id: `${part.id}:${i}`, set: { id: set.id, name: set.name } })); });
}

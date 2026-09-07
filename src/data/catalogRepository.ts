import { db } from './db';
import { createId } from './id';
import type { Favorite, FavoriteKind, MealSet, MealSetItem, Recipe } from '../domain/catalog';
import type { MealEntry, MealType, Nutrients } from '../domain/types';
import { positive, recipeTotal, setTotal } from '../domain/foods';
import { validateMeal, validLocalDateTime } from '../domain/validation';
import { saveMeal } from './repository';
export type RecipeDraft = Pick<Recipe, 'name' | 'ingredients' | 'servings'>;
function validName(name: string): string {
  if (!name.trim() || name.trim().length > 100) throw new Error('名前は1〜100文字で入力してください。');
  return name.trim();
}
function validNutrients(nutrients: Nutrients) {
  if (Object.values(nutrients).some(value => !Number.isFinite(value) || value < 0)) throw new Error('栄養値は0以上の有限の数値で入力してください。');
}
export function validateRecipe(draft: RecipeDraft) {
  validName(draft.name); positive(draft.servings, '食数', 100);
  if (!draft.ingredients.length || draft.ingredients.length > 100) throw new Error('材料は1〜100個で登録してください。');
  draft.ingredients.forEach(item => { positive(item.grams, '材料の重量'); validNutrients(item.per100g); });
  validNutrients(recipeTotal(draft));
}
export async function saveRecipe(draft: RecipeDraft, id?: string, expectedUpdatedAt?: string): Promise<Recipe> {
  validateRecipe(draft);
  return db.transaction('rw', db.recipes, async () => {
    const original = id ? await db.recipes.get(id) : undefined;
    if (id && !original) throw new Error('元のレシピが見つかりません。別レシピとして保存してください。');
    if (expectedUpdatedAt && original?.updatedAt !== expectedUpdatedAt) throw new Error('レシピが別の画面で変更されました。開き直してください。');
    const now = new Date().toISOString();
    const recipe: Recipe = { ...structuredClone(draft), id: original?.id ?? createId(), name: draft.name.trim(), createdAt: original?.createdAt ?? now, updatedAt: now };
    await db.recipes.put(recipe);
    return recipe;
  });
}
export async function duplicateRecipe(recipe: Recipe, name: string): Promise<Recipe> { return saveRecipe({ ...recipe, name }); }
export function favoriteId(kind: FavoriteKind, sourceId: string, quantity: number): string { return `${kind}:${sourceId}:${quantity}`; }
export async function saveFavorite(kind: FavoriteKind, sourceId: string, quantity: number): Promise<Favorite> {
  positive(quantity, '量');
  const favorite: Favorite = { id: favoriteId(kind, sourceId, quantity), kind, sourceId, quantity, createdAt: new Date().toISOString() };
  await db.favorites.put(favorite); return favorite;
}
export async function removeFavorite(id: string): Promise<void> { await db.favorites.delete(id); }
export async function saveSet(name: string, items: MealSetItem[], id?: string): Promise<MealSet> {
  const trimmed = validName(name);
  if (!items.length || items.length > 100) throw new Error('セットには1〜100個の食品・レシピを追加してください。');
  items.forEach(item => { positive(item.quantity, '量'); validNutrients(item.nutrients); });
  return db.transaction('rw', db.mealSets, async () => {
    const previous = id ? await db.mealSets.get(id) : undefined;
    if (id && !previous) throw new Error('セットが見つかりません。');
    const now = new Date().toISOString();
    const result: MealSet = { id: previous?.id ?? createId(), name: trimmed, items: structuredClone(items), total: setTotal(items), createdAt: previous?.createdAt ?? now, updatedAt: now };
    await db.mealSets.put(result); return result;
  });
}
export interface MealContext { date: string; time: string; mealType: MealType }
export async function registerItems(items: MealSetItem[], context: MealContext, set?: Pick<MealSet, 'id' | 'name'>): Promise<MealEntry[]> {
  if (!validLocalDateTime(context.date, context.time)) throw new Error('日付・時刻を正しく入力してください。');
  if (!items.length) throw new Error('食品を選択してください。');
  const now = new Date().toISOString();
  const runId = set ? createId() : undefined;
  const entries: MealEntry[] = items.map(item => {
    const entry: MealEntry = { ...item.nutrients, id: createId(), name: item.name, restaurant: '', mealType: context.mealType, eatenAt: new Date(`${context.date}T${context.time}:00`).toISOString(), createdAt: now, updatedAt: now, sourceType: item.kind === 'recipe' ? 'recipe' : item.kind === 'food' ? 'database' : 'official', confidence: null, sourceId: item.sourceId, quantity: item.quantity, unit: item.unit, sourceVersion: item.sourceVersion, notes: item.notes, recipeSnapshot: item.recipeSnapshot, setId: set?.id, setName: set?.name, setRunId: runId };
    const error = validateMeal(entry); if (error) throw new Error(error);
    return structuredClone(entry);
  });
  // Bulk registration is atomic: a set cannot be saved only halfway.
  await db.transaction('rw', db.meals, async () => { await db.meals.bulkAdd(entries); });
  return entries;
}
export async function quickEntry(calories: number, name: string, context: MealContext) {
  if (!validLocalDateTime(context.date, context.time)) throw new Error('日付・時刻を正しく入力してください。');
  return saveMeal({ name: name.trim() || 'かんたん入力', calories, protein: 0, fat: 0, carbs: 0, mealType: context.mealType, eatenAt: new Date(`${context.date}T${context.time}:00`).toISOString() });
}

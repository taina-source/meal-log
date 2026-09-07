import type { Food, MealSetItem, Recipe, RecipeIngredient } from './catalog';
import type { Nutrients } from './types';
import { sumNutrients } from './nutrition';
export function normalizeSearch(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, character => String.fromCharCode(character.charCodeAt(0) - 0x60)).replace(/[\s・･＜＞<>［］\[\]（）()]/g, '');
}
export function searchFoods(foods: Food[], query: string): Food[] {
  const tokens = query.trim().split(/\s+/).map(normalizeSearch).filter(Boolean);
  if (!tokens.length) return foods;
  return foods.filter(food => tokens.every(token => normalizeSearch([food.name, ...food.aliases].join(' ')).includes(token))).sort((a, b) => {
    const exact = (food: Food) => food.aliases.some(alias => normalizeSearch(alias) === normalizeSearch(query)) ? 1 : 0;
    return exact(b) - exact(a);
  });
}
export function positive(value: number, label: string, max = 10000): number {
  if (!Number.isFinite(value) || value <= 0 || value > max) throw new Error(`${label}は0より大きく${max}以下で入力してください。`);
  return value;
}
export function scaleNutrients(value: Nutrients, ratio: number): Nutrients {
  if (!Number.isFinite(ratio) || ratio < 0) throw new Error('量が正しくありません。');
  return { calories: value.calories * ratio, protein: value.protein * ratio, fat: value.fat * ratio, carbs: value.carbs * ratio };
}
export function foodPer100g(food: Food): Nutrients {
  const read = (key: keyof Nutrients) => {
    const status = food.status[key];
    if (status === 'missing') throw new Error('未測定の栄養値があるため、この食品は自動計算で登録できません。');
    // Trace is not a measured zero: approximate only during calculation,
    // retaining raw symbols and a visible note on each meal snapshot.
    if (status === 'trace' || status === 'estimated-trace') return 0;
    const value = food[`${key}Per100g`];
    if (value === null || !Number.isFinite(value) || value < 0) throw new Error('食品データが不正です。');
    return value;
  };
  return { calories: read('calories'), protein: read('protein'), fat: read('fat'), carbs: read('carbs') };
}
export function foodNotes(food: Food): string[] {
  const notes: string[] = [];
  if (Object.values(food.status).some(status => status.includes('trace'))) notes.push('Tr（微量）は計算上0として近似しています。');
  if (Object.values(food.status).some(status => status.startsWith('estimated'))) notes.push('括弧付きの公式推定値を含みます。');
  return notes;
}
export function foodNutrients(food: Food, grams: number): Nutrients { return scaleNutrients(foodPer100g(food), positive(grams, '重量') / 100); }
export function recipeTotal(recipe: Pick<Recipe, 'ingredients'>): Nutrients { return sumNutrients(recipe.ingredients.map(item => scaleNutrients(item.per100g, positive(item.grams, '材料の重量') / 100))); }
export function recipePortion(recipe: Recipe, fraction = 1 / recipe.servings): Nutrients { positive(recipe.servings, '食数', 100); return scaleNutrients(recipeTotal(recipe), positive(fraction, '全体に対する割合', 100)); }
export function ingredientFromFood(food: Food, grams: number, id: string): RecipeIngredient { return { id, foodId: food.id, name: food.name, grams: positive(grams, '重量'), per100g: foodPer100g(food), sourceVersion: food.sourceVersion, notes: foodNotes(food) }; }
export function foodItem(food: Food, grams: number, id: string): MealSetItem { return { id, kind: 'food', sourceId: food.id, name: food.name, quantity: grams, unit: 'g', nutrients: foodNutrients(food, grams), sourceVersion: food.sourceVersion, notes: foodNotes(food) }; }
export function recipeItem(recipe: Recipe, fraction: number, id: string): MealSetItem { return { id, kind: 'recipe', sourceId: recipe.id, name: recipe.name, quantity: fraction, unit: 'whole', nutrients: recipePortion(recipe, fraction), notes: [...new Set(recipe.ingredients.flatMap(item => item.notes))], recipeSnapshot: structuredClone(recipe) }; }
export function setTotal(items: MealSetItem[]): Nutrients { return sumNutrients(items.map(item => item.nutrients)); }

import { describe, expect, it } from 'vitest';
import { foodItem, foodNutrients, foodNotes, ingredientFromFood, normalizeSearch, recipePortion, recipeTotal, searchFoods, setTotal } from './foods';
import type { Food, Recipe } from './catalog';
import dataset from '../../public/data/mext-foods.json';
const foods = dataset.foods as Food[];
export const rice = foods.find(food => food.id === 'mext-01088')!;
export const egg = foods.find(food => food.id === 'mext-12004')!;
export function sampleRecipe(): Recipe { return { id: 'recipe-test', name: 'ご飯と卵', ingredients: [ingredientFromFood(rice, 200, 'rice'), ingredientFromFood(egg, 100, 'egg')], servings: 2, createdAt: '2026-09-07T00:00:00Z', updatedAt: '2026-09-07T00:00:00Z' }; }
describe('公式食品データと検索', () => {
  it('公式食品2538件・一意ID・標準のPFC列を使用する', () => { expect(foods).toHaveLength(2538); expect(new Set(foods.map(food => food.id)).size).toBe(2538); expect(rice).toMatchObject({ caloriesPer100g: 156, proteinPer100g: 2.5, fatPer100g: .3, carbsPer100g: 37.1 }); expect(egg.caloriesPer100g).toBe(142); });
  it.each([50,100,150,200,250])('%igのカロリー・PFCを計算する', grams => { const value = foodNutrients(rice, grams); expect(value.calories).toBeCloseTo(156 * grams / 100); expect(value.protein).toBeCloseTo(2.5 * grams / 100); expect(value.fat).toBeCloseTo(.3 * grams / 100); expect(value.carbs).toBeCloseTo(37.1 * grams / 100); });
  it.each(['ご飯','白米','白ごはん','ごはん'])('別名「%s」でご飯に到達する', query => expect(searchFoods(foods, query)[0].id).toBe(rice.id));
  it.each(['鶏むね','鶏胸肉','とりむね'])('別名「%s」で鶏むねに到達する', query => expect(searchFoods(foods, query).some(food => food.id === 'mext-11220')).toBe(true));
  it('部分一致・ひらがなカタカナ・全半角・英大小を吸収する', () => { expect(searchFoods(foods, 'オートミール')).toEqual(searchFoods(foods, 'おーとみーる')); expect(searchFoods(foods, 'ｵｰﾄﾐｰﾙ')).toEqual(searchFoods(foods, 'オートミール')); expect(normalizeSearch('ＡＢＣ')).toBe(normalizeSearch('abc')); expect(searchFoods(foods, '卵').some(food => food.id === egg.id)).toBe(true); expect(searchFoods(foods, '鶏むね 皮なし').length).toBeGreaterThan(0); });
  it('特殊値はnull・原表記保持、Trは注記付き近似、未測定は拒否', () => { const trace = foods.find(food => Object.values(food.status).includes('trace'))!; expect(foodNotes(trace).join()).toContain('近似'); for (const key of ['calories','protein','fat','carbs'] as const) if (trace.status[key] === 'trace') { expect(trace[`${key}Per100g`]).toBeNull(); expect(trace.raw[key]).toBe('Tr'); expect(foodNutrients(trace, 100)[key]).toBe(0); } const missing = foods.find(food => Object.values(food.status).includes('missing'))!; expect(() => foodNutrients(missing, 100)).toThrow('未測定'); });
  it.each([0,-1,NaN,Infinity,10001])('異常な重量 %s を拒否する', grams => expect(() => foodNutrients(rice, grams)).toThrow());
});
describe('レシピとセットの計算', () => {
  it('材料の重量から全体を計算する', () => expect(recipeTotal(sampleRecipe())).toEqual({ calories: 454, protein: 17.2, fat: 10.8, carbs: 74.6 }));
  it('食数による1食分', () => expect(recipePortion(sampleRecipe()).calories).toBe(227));
  it.each([.5,1/3,.25])('全体の割合 %s を計算する', fraction => expect(recipePortion(sampleRecipe(), fraction).calories).toBeCloseTo(454 * fraction));
  it('セット合計は構成要素の和', () => expect(setTotal([foodItem(rice, 200, '1'),foodItem(egg,100,'2')]).calories).toBe(454));
  it('食数0と空でない不正材料を拒否する', () => { expect(() => recipePortion({ ...sampleRecipe(), servings: 0 })).toThrow(); expect(() => recipeTotal({ ingredients: [{ ...sampleRecipe().ingredients[0], grams: -1 }] })).toThrow(); });
});

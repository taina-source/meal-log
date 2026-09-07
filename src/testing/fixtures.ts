import type { Food, Recipe } from '../domain/catalog';
import { ingredientFromFood } from '../domain/foods';
import dataset from '../../public/data/mext-foods.json';
export const foods = dataset.foods as Food[];
export const rice = foods.find(food => food.id === 'mext-01088')!;
export const egg = foods.find(food => food.id === 'mext-12004')!;
export function sampleRecipe(): Recipe { return { id: 'recipe-test', name: 'ご飯と卵', ingredients: [ingredientFromFood(rice, 200, 'rice'), ingredientFromFood(egg, 100, 'egg')], servings: 2, createdAt: '2026-09-07T00:00:00Z', updatedAt: '2026-09-07T00:00:00Z' }; }

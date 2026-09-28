import 'fake-indexeddb/auto';
import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { db, MealLogDatabase } from './db';
import { foodUnits, portionGrams } from '../domain/foodUnits';
import { foodItem, foodNutrients, ingredientFromFood, recipeTotal } from '../domain/foods';
import type { Food } from '../domain/catalog';
import catalog from '../../public/data/mext-foods.json';
import { registerItems, saveFavorite, saveRecipe, saveSet } from './catalogRepository';
import { exportBackup, restoreBackup, backupText } from './backup';
import { parseBackup } from '../domain/backup';
vi.mock('./db', async importOriginal => {
  const module = await importOriginal<typeof import('./db')>();
  return { ...module, db: new module.MealLogDatabase('food-units-isolated') };
});
const other = new MealLogDatabase('food-units-roundtrip');
beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });
afterAll(async () => { await db.delete(); await other.delete(); });
const food = (id: string) => catalog.foods.find(f => f.id === id)! as Food;
const context = { date: '2026-09-24', time: '12:00', mealType: 'lunch' as const };
it('exactly nine IDs; related names do not inherit units', () => {
 expect(catalog.foods.filter(f => foodUnits(f.id).length)).toHaveLength(9);
 for (const id of ['mext-01085','mext-12010','mext-13004','mext-17008','unknown']) expect(foodUnits(id)).toEqual([]);
});
it.each([
 ['mext-01088','cooked-go',1,340,340], ['mext-01088','cooked-go',.5,340,170],
 ['mext-01083','go',1,150,150], ['mext-12004','piece',2,50,100], ['mext-12005','piece',2,50,100],
 ['mext-13003','ml',200,1.03,206], ['mext-03003','tsp',1,3,3], ['mext-03003','tbsp',1,9,9],
 ['mext-14001','tsp',1,4,4], ['mext-14001','tbsp',1,12,12], ['mext-17007','tsp',1,6,6], ['mext-17007','tbsp',1,18,18],
] as const)('%s %s quantity %s', (id,unit,count,weight,expected) => {
 expect(foodUnits(id).find(u => u.id===unit)?.gramsPerUnit).toBe(weight);
 expect(portionGrams(id,unit,count,weight)).toBeCloseTo(expected,12);
});
it('bread requires a user supplied weight', () => {
 expect(foodUnits('mext-01026')[0].gramsPerUnit).toBeUndefined();
 expect(() => portionGrams('mext-01026','slice',2)).toThrow();
 expect(portionGrams('mext-01026','slice',2,65)).toBe(130);
});
it.each([0,-1,NaN,Infinity,10001])('reject invalid quantity/weight %s', value => {
 expect(() => portionGrams('mext-12004','piece',value,50)).toThrow();
 expect(() => portionGrams('mext-12004','piece',1,value)).toThrow();
 expect(() => portionGrams('mext-12004','g',value)).toThrow();
});
it('reject overflow and wrong food/unit pairing', () => {
 expect(() => portionGrams('mext-12004','piece',10000,50)).toThrow();
 expect(() => portionGrams('mext-12004','go',1,150)).toThrow();
});
it('custom weight does not mutate defaults; g retains decimals', () => {
 expect(portionGrams('mext-12004','piece',2,55)).toBe(110);
 expect(foodUnits('mext-12004')[0].gramsPerUnit).toBe(50);
 expect(portionGrams('mext-12004','g',123.456)).toBe(123.456);
});
it('nutrition is scaled only once and uses the selected raw/cooked food', () => {
 const grams=portionGrams('mext-12004','piece',2,50);
 expect(foodNutrients(food('mext-12004'),grams).calories).toBe(142);
 expect(foodNutrients(food('mext-12005'),grams).calories).toBe(134);
 expect(foodNutrients(food('mext-01083'),150).calories).toBe(513);
 expect(foodNutrients(food('mext-01088'),340).calories).toBeCloseTo(530.4,12);
});
it('register/favorite/recipe/set and JSON restore preserve canonical grams and saved nutrition', async () => {
 const rice=food('mext-01088'), grams=portionGrams(rice.id,'cooked-go',.5,340);
 const item=foodItem(rice,grams,'item');
 const [meal]=await registerItems([item],context);
 expect(meal).toMatchObject({quantity:170,unit:'g',sourceType:'database',sourceId:rice.id});
 expect(meal.calories).toBeCloseTo(265.2,12);
 const favorite=await saveFavorite('food',rice.id,grams); expect(favorite.quantity).toBe(170);
 const recipe=await saveRecipe({name:'ご飯',ingredients:[ingredientFromFood(rice,grams,'ingredient')],servings:1});
 expect(recipeTotal(recipe)).toEqual(item.nutrients);
 const set=await saveSet('セット',[item]); const [setMeal]=await registerItems(set.items,context,set);
 expect(setMeal.calories).toBe(meal.calories);
 const backup=await exportBackup(db); await restoreBackup(parseBackup(backupText(backup)),other);
 expect((await exportBackup(other,backup.exportedAt)).data).toEqual(backup.data);
 portionGrams(rice.id,'cooked-go',1,400);
 expect(await db.meals.get(meal.id)).toEqual(meal);
 expect(db.verno).toBe(3);
});

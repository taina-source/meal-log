import 'fake-indexeddb/auto';
import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { scaleSavedPortion, reuseFactor } from '../domain/reusePortions';
import { db } from './db';
import { reuseSavedMeals, favoriteSavedMeal } from './reuseMeals';
import { registerChatgpt } from './chatgpt';
import { readChatgptJson } from '../domain/chatgpt';
import { registerItems, saveSet } from './catalogRepository';
import { recipeItem } from '../domain/foods';
import type { MealEntry } from '../domain/types';
vi.mock('./db', async importOriginal => {
  const actual = await importOriginal<typeof import('./db')>();
  return { ...actual, db: new actual.MealLogDatabase('meal-log-reuse-portion-test') };
});
const nutrients = { calories: 100, protein: 10, fat: 2, carbs: 10 };
const context = { date: '2026-09-29', time: '12:00', mealType: 'lunch' as const };
const meal = (): MealEntry => ({ id: 'old', name: '元の料理', restaurant: '', ...nutrients, sourceType: 'manual', confidence: null, mealType: 'lunch', eatenAt: '2026-09-28T03:00:00.000Z', createdAt: '2026-09-28T03:00:00.000Z', updatedAt: '2026-09-28T03:00:00.000Z' });
beforeEach(async () => { await Promise.all([db.meals.clear(), db.favorites.clear(), db.mealSets.clear()]); });
afterAll(() => db.delete());
it.each([0.5, 1, 2])('manual %s倍 preserves history and favorite', async factor => {
  const original = meal(); await db.meals.add(original); const f = await favoriteSavedMeal(original);
  const [saved] = await reuseSavedMeals([original], [scaleSavedPortion(original, factor)], context);
  expect(saved).toMatchObject({ calories: 100 * factor, protein: 10 * factor, fat: 2 * factor, carbs: 10 * factor });
  expect(await db.meals.get(original.id)).toEqual(original); expect((await db.favorites.get(f.id))?.mealSnapshot).toEqual(original);
});
it.each([0, -1, NaN, Infinity, 100.01])('rejects factor %s', factor => expect(() => scaleSavedPortion(nutrients, factor)).toThrow());
it.each(['', ' ', '0', '-1', 'NaN', 'Infinity', '10001'])('rejects quantity input %s', input => expect(() => reuseFactor(2, input)).toThrow());
it('never rounds or multiplies original quantity twice', () => {
  const original = { ...nutrients, calories: 123.456789, quantity: 2 };
  expect(scaleSavedPortion(original, reuseFactor(2, '3'))).toMatchObject({ calories: 123.456789 * 1.5, quantity: 3, protein: 15 });
  expect(scaleSavedPortion(original, reuseFactor(2, '1')).calories).toBe(123.456789 * 0.5);
  expect(original.quantity).toBe(2);
});
it('null values stay null, no fabricated zero', () => expect(scaleSavedPortion({ ...nutrients, protein: null, fat: null }, 2)).toEqual({ calories: 200, protein: null, fat: null, carbs: 20 }));
it('overflow and corrupt stored values rejected', () => {
  expect(() => scaleSavedPortion({ ...nutrients, calories: Number.MAX_VALUE }, 2)).toThrow();
  expect(() => scaleSavedPortion({ ...nutrients, protein: NaN }, 1)).toThrow();
  expect(() => scaleSavedPortion({ ...nutrients, quantity: 6000 }, 2)).toThrow();
});
it('ChatGPT group uses independent quantities, saved totals, unchanged snapshots', async () => {
  const receipt = readChatgptJson(JSON.stringify({ schemaVersion: 1, type: 'meal-log-chatgpt', items: [1, 2].map(i => ({ name: `料理${i}`, restaurant: '', ...nutrients, quantity: 2, unit: '個', sourceType: 'estimate', sourceUrl: '', sourceTitle: '', confidence: 'medium', notes: '元の出典' })) }));
  const originals = await registerChatgpt(receipt, receipt.payload!.items, context);
  const edited = originals.map((m, i) => scaleSavedPortion(m, reuseFactor(m.quantity, i === 0 ? '1' : '4')));
  const saved = await reuseSavedMeals(originals, edited, context);
  expect(saved.map(m => m.calories)).toEqual([100, 400]); expect(saved.map(m => m.quantity)).toEqual([1, 4]);
  expect(saved.every(m => m.chatgptUserModified && m.chatgptModifiedBeforeSave)).toBe(true);
  expect(saved.map(m => m.chatgptSnapshot)).toEqual(originals.map(m => m.chatgptSnapshot));
  expect(await db.meals.bulkGet(originals.map(m => m.id))).toEqual(originals);
  expect(new Set(saved.map(m => m.chatgptImportId)).size).toBe(1);
});
it('set quantities alter only new entries, preserving set and recipe snapshot', async () => {
  const recipe = { id: 'r', name: 'レシピ', ingredients: [{ id: 'i', foodId: 'f', name: '材料', grams: 100, per100g: nutrients, sourceVersion: 'test', notes: [] }], servings: 2, createdAt: '', updatedAt: '' };
  const item = recipeItem(recipe, 0.5, 'i'); const set = await saveSet('セット', [item]);
  const changed = { ...item, quantity: 0.25, nutrients: scaleSavedPortion(item.nutrients, reuseFactor(item.quantity, '0.25')) };
  const [saved] = await registerItems([changed], context, set);
  expect(saved).toMatchObject({ calories: 25, quantity: 0.25, recipeSnapshot: recipe }); expect(await db.mealSets.get(set.id)).toEqual(set);
});

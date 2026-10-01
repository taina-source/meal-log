import 'fake-indexeddb/auto';
import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { db } from './db';
import { registerChatgpt } from './chatgpt';
import { reuseSavedMeals } from './reuseMeals';
import { readChatgptJson } from '../domain/chatgpt';
import { scaleSavedPortion } from '../domain/reusePortions';
import { localSearchResults } from '../domain/unifiedSearch';
vi.mock('./db', async importOriginal => {
  const actual = await importOriginal<typeof import('./db')>();
  return { ...actual, db: new actual.MealLogDatabase('meal-log-partial-reuse-test') };
});
const context = { date: '2026-10-01', time: '12:35', mealType: 'lunch' as const };
beforeEach(() => db.meals.clear());
afterAll(() => db.delete());
async function group() {
  const receipt = readChatgptJson(JSON.stringify({ schemaVersion: 1, type: 'meal-log-chatgpt', items: ['ご飯', 'みそ汁', 'おかず'].map(name => ({ name, restaurant: '', calories: 100, protein: 10, fat: 2, carbs: 10, quantity: 1, unit: '皿', sourceType: 'estimate', sourceUrl: '', sourceTitle: '', confidence: 'medium', notes: '元の推定' })) }));
  return registerChatgpt(receipt, receipt.payload!.items, context);
}
it.each([[1], [0, 2], [0, 1, 2]])('selected indices %j only are saved with new IDs', async (...indices: number[]) => {
  const originals = await group(), before = structuredClone(originals), selected = indices.map(i => originals[i]);
  const saved = await reuseSavedMeals(selected, selected, context);
  expect(saved.map(m => m.name)).toEqual(selected.map(m => m.name));
  expect(saved.every(m => !originals.some(o => o.id === m.id))).toBe(true);
  expect(new Set(saved.map(m => m.chatgptImportId)).size).toBe(1);
  expect(saved[0].chatgptImportId).not.toBe(originals[0].chatgptImportId);
  expect(saved.map(m => m.chatgptSnapshot)).toEqual(selected.map(m => m.chatgptSnapshot));
  expect(await db.meals.count()).toBe(3 + selected.length);
  expect(await db.meals.bulkGet(originals.map(m => m.id))).toEqual(before);
  expect(originals).toEqual(before);
});
it('rejects zero selected items without writing', async () => {
  const originals = await group();
  await expect(reuseSavedMeals([], [], context)).rejects.toThrow('1〜20品');
  expect(await db.meals.toArray()).toEqual([...originals].sort((a, b) => a.id.localeCompare(b.id)));
});
it('independent 0.5 and 2 factors preserve source snapshots and original group', async () => {
  const originals = await group(), selected = [originals[0], originals[2]];
  const edited = selected.map((m, i) => scaleSavedPortion(m, i === 0 ? 0.5 : 2));
  const saved = await reuseSavedMeals(selected, edited, context);
  expect(saved.map(m => [m.quantity, m.calories, m.protein, m.fat, m.carbs])).toEqual([[0.5, 50, 5, 1, 5], [2, 200, 20, 4, 20]]);
  expect(saved.every(m => m.chatgptUserModified && m.chatgptModifiedBeforeSave)).toBe(true);
  expect(saved.map(m => m.chatgptSnapshot)).toEqual(selected.map(m => m.chatgptSnapshot));
  expect(await db.meals.bulkGet(originals.map(m => m.id))).toEqual(originals);
});
it('transaction rolls back earlier inserts on a later storage failure', async () => {
  const originals = await group(); let creates = 0;
  const fail = () => { if (++creates === 2) throw new Error('injected second insert failure'); };
  db.meals.hook('creating', fail);
  try { await expect(reuseSavedMeals(originals, originals, context)).rejects.toThrow(); }
  finally { db.meals.hook('creating').unsubscribe(fail); }
  expect(creates).toBeGreaterThanOrEqual(2);
  expect(await db.meals.count()).toBe(3);
  expect(await db.meals.bulkGet(originals.map(m => m.id))).toEqual(originals);
});
it('unified history keeps the entire group available for individual selection', async () => {
  const meals = await group();
  const rows = localSearchResults({ meals, foods: [], favorites: [], recipes: [], sets: [], menus: [] });
  const history = rows.filter(r => r.category === 'history');
  expect(history).toHaveLength(1);
  const reference = history[0].reference;
  if (!reference) throw new Error('ChatGPT history must have a reuse reference');
  expect(new Set(reference.savedEntries?.map(m => m.id))).toEqual(new Set(meals.map(m => m.id)));
});

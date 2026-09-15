import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import { db } from './db';
import { favoriteSavedMeal, reuseSavedMeals } from './reuseMeals';
import { savedMealHistory, savedMealKind } from '../domain/reuseMeals';
import { registerChatgpt } from './chatgpt';
import { readChatgptJson } from '../domain/chatgpt';
import { saveFavorite, removeFavorite, quickEntry } from './catalogRepository';
import { getDayMeals } from './repository';
import { sumNutrients } from '../domain/nutrition';
import type { MealEntry } from '../domain/types';

const context = { date: '2026-09-15', time: '12:00', mealType: 'lunch' as const };
const meal = (id = 'manual'): MealEntry => ({ id, name: '手動料理', restaurant: '', calories: 600, protein: 30, fat: 20, carbs: 75, sourceType: 'manual', confidence: null, mealType: 'breakfast', eatenAt: '2026-09-14T00:00:00.000Z', createdAt: '2026-09-14T00:00:00.000Z', updatedAt: '2026-09-14T00:00:00.000Z' });
async function chat(count = 1) {
  const receipt = readChatgptJson(JSON.stringify({ schemaVersion: 1, type: 'meal-log-chatgpt', inputType: 'photo', items: Array.from({ length: count }, (_, i) => ({ name: `写真料理${i}`, restaurant: '', calories: 500, protein: 30, fat: 20, carbs: 50, quantity: 1, unit: '皿', sourceType: 'estimate', sourceUrl: '', sourceTitle: '', confidence: 'medium', notes: '量を推定' })) }));
  return registerChatgpt(receipt, receipt.payload!.items.map(item => ({ ...item, quantity: 2, calories: 620 })), { ...context, date: '2026-09-14' });
}
beforeEach(async () => { await db.meals.clear(); await db.favorites.clear(); });

it('ChatGPT単品は修正後の最終合計を再利用し数量を再乗算しない', async () => {
  const original = await chat(); const before = structuredClone(original);
  const [next] = await reuseSavedMeals(original, original, context);
  expect(next.calories).toBe(1240); expect(next.quantity).toBe(2); expect(next.chatgptSnapshot?.calories).toBe(500);
  expect(next.chatgptUserModified).toBe(true); expect(next.chatgptSnapshot).toEqual(original[0].chatgptSnapshot);
  expect(next.id).not.toBe(original[0].id); expect(next.chatgptImportId).not.toBe(original[0].chatgptImportId);
  expect(original).toEqual(before); expect(await db.meals.get(original[0].id)).toEqual(before[0]);
});
it('複数ChatGPT履歴をまとめ新しい共通importIdで保存しHomeとHistoryに反映', async () => {
  const original = await chat(3), groups = savedMealHistory(original, 'chatgptMeal');
  expect(groups).toHaveLength(1); expect(groups[0].entries).toHaveLength(3);
  const next = await reuseSavedMeals(groups[0].entries, groups[0].entries, context);
  expect(new Set(next.map(m => m.id)).size).toBe(3); expect(new Set(next.map(m => m.chatgptImportId)).size).toBe(1);
  expect(next[0].chatgptImportId).not.toBe(original[0].chatgptImportId);
  expect(sumNutrients(await getDayMeals(context.date)).calories).toBe(3720);
  expect(await db.meals.orderBy('eatenAt').count()).toBe(6);
});
it('importIdのないChatGPTと別取り込みは混ぜず、明示時刻順に表示', () => {
  const a = { ...meal('a'), sourceType: 'chatgpt' as const }, b = { ...a, id: 'b', createdAt: '2026-09-14T01:00:00.000Z' };
  expect(savedMealHistory([a, b], 'chatgptMeal').map(g => g.entries[0].id)).toEqual(['b', 'a']);
});
it('手動履歴の名前・数量・単位・最終栄養を再利用し元記録を保持', async () => {
  const original = { ...meal(), quantity: 2, unit: 'item' as const }; await db.meals.add(original);
  const [next] = await reuseSavedMeals([original], [{ ...original, name: '今回の料理', calories: 700 }], context);
  expect(next).toMatchObject({ name: '今回の料理', calories: 700, protein: 30, quantity: 2, unit: 'item', sourceType: 'manual' });
  expect(next.id).not.toBe(original.id); expect(await db.meals.get(original.id)).toEqual(original);
});
it('かんたん入力も手動履歴に入り保存済みPFCを再利用', async () => {
  await quickEntry(800, 'かんたん', context);
  const original = await db.meals.toArray(); expect(savedMealHistory(original, 'manualMeal')).toHaveLength(1);
  const [next] = await reuseSavedMeals(original, original, context); expect(next).toMatchObject({ calories: 800, protein: 0, fat: 0, carbs: 0 });
});
it('食品・レシピ・セット・外食・ChatGPT由来を手動カテゴリに重複させない', () => {
  for (const patch of [{ sourceType: 'database' }, { sourceType: 'recipe' }, { sourceType: 'official' }, { sourceType: 'chatgpt' }, { setId: 'set' }, { setRunId: 'run' }, { restaurantId: 'kfc' }, { sourceId: 'food' }]) {
    expect(savedMealKind({ ...meal(), ...patch } as MealEntry)).not.toBe('manualMeal');
  }
  expect(savedMealKind(meal())).toBe('manualMeal');
});
it('個々のChatGPT料理をsnapshotお気に入りにし元削除後も再利用', async () => {
  const originals = await chat(2), favorite = await favoriteSavedMeal(originals[0]);
  await db.meals.delete(originals[0].id);
  const stored = (await db.favorites.get(favorite.id))!;
  const [next] = await reuseSavedMeals([stored.mealSnapshot!], [stored.mealSnapshot!], context);
  expect(next.calories).toBe(1240); expect(next.chatgptSnapshot).toEqual(originals[0].chatgptSnapshot);
  expect(next.chatgptImportId).not.toBe(originals[0].chatgptImportId);
  expect((await db.favorites.get(favorite.id))!.mealSnapshot).toEqual(originals[0]);
});
it('手動お気に入りは元履歴の編集・削除後も不変、再登録の編集も波及しない', async () => {
  const original = meal(); await db.meals.add(original); const favorite = await favoriteSavedMeal(original);
  await db.meals.update(original.id, { calories: 999 }); await favoriteSavedMeal({ ...original, calories: 999 });
  await db.meals.delete(original.id);
  const [next] = await reuseSavedMeals([favorite.mealSnapshot!], [{ ...original, calories: 700 }], context);
  expect(next.calories).toBe(700); expect((await db.favorites.get(favorite.id))!.mealSnapshot).toEqual(original);
  await removeFavorite(favorite.id); expect(await db.favorites.get(favorite.id)).toBeUndefined();
});
it('ChatGPT再利用編集で修正フラグを残し元回答・出典・confidence・notesは保持', async () => {
  const originals = await chat(); const [next] = await reuseSavedMeals(originals, [{ ...originals[0], protein: 80 }], context);
  expect(next.chatgptModifiedBeforeSave).toBe(true); expect(next.chatgptSnapshot).toEqual(originals[0].chatgptSnapshot);
  expect(next.chatgptSnapshot).toMatchObject({ inputType: 'photo', confidence: 'medium', notes: '量を推定' });
});
it('既存食品・レシピ・セット・店舗・外食お気に入りを維持', async () => {
  const existing = await Promise.all((['food', 'recipe', 'set', 'restaurant', 'restaurantMenu'] as const).map(kind => saveFavorite(kind, kind, 1)));
  await favoriteSavedMeal(meal());
  expect(await db.favorites.bulkGet(existing.map(f => f.id))).toEqual(existing); expect(db.verno).toBe(3);
});
it('不正栄養・数量では複数品の一部も保存しない', async () => {
  for (const patch of [{ protein: NaN }, { calories: -1 }, { quantity: 0 }]) {
    await expect(reuseSavedMeals([meal('a'), meal('b')], [meal('a'), { ...meal('b'), ...patch }], context)).rejects.toThrow();
    expect(await db.meals.count()).toBe(0);
  }
});
it('再利用時に前日コピー識別情報を引き継がない', async () => {
  const original = { ...meal(), copiedFromId: 'past', copyTargetDate: '2026-09-14' };
  const [next] = await reuseSavedMeals([original], [original], context);
  expect(next.copiedFromId).toBeUndefined(); expect(next.copyTargetDate).toBeUndefined(); expect(original.copiedFromId).toBe('past');
});

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, MealLogDatabase } from './db';
import { deleteMeal, getDayMeals, getSettings, saveMeal, saveSettings, saveWeight } from './repository';
import { sumNutrients } from '../domain/nutrition';
import { defaultSettings, type MealInput } from '../domain/types';
const input: MealInput = { name: '鶏むね肉とご飯', calories: 620, protein: 52.2, fat: 12, carbs: 75, mealType: 'lunch', eatenAt: new Date('2026-09-06T12:00:00').toISOString() };
beforeEach(async () => { await db.meals.clear(); await db.weights.clear(); await db.settings.clear(); });
describe('端末内リポジトリ', () => {
  it('追加・編集・日付移動・削除後の合計を導出する', async () => {
    const entry = await saveMeal(input);
    expect(entry.sourceType).toBe('manual'); expect(entry.confidence).toBeNull();
    expect(sumNutrients(await getDayMeals('2026-09-06')).calories).toBe(620);
    const edited = await saveMeal({ ...input, calories: 700 }, entry.id);
    expect(edited.id).toBe(entry.id); expect(edited.createdAt).toBe(entry.createdAt);
    expect(sumNutrients(await getDayMeals('2026-09-06')).calories).toBe(700);
    await saveMeal({ ...input, eatenAt: new Date('2026-09-07T00:00:00').toISOString() }, entry.id);
    expect(await getDayMeals('2026-09-06')).toHaveLength(0); expect(await getDayMeals('2026-09-07')).toHaveLength(1);
    await deleteMeal(entry.id); expect(sumNutrients(await getDayMeals('2026-09-07')).calories).toBe(0);
  });
  it('日次集計は開始を含み、翌日0時を含まない', async () => {
    await saveMeal({ ...input, eatenAt: new Date('2026-09-06T00:00:00').toISOString() });
    await saveMeal({ ...input, eatenAt: new Date('2026-09-06T23:59:00').toISOString() });
    await saveMeal({ ...input, eatenAt: new Date('2026-09-07T00:00:00').toISOString() });
    expect(await getDayMeals('2026-09-06')).toHaveLength(2);
  });
  it('同じ日の体重は更新し重複しない', async () => { await saveWeight('2026-09-06', 102.8); await saveWeight('2026-09-06', 102.5); expect(await db.weights.count()).toBe(1); expect((await db.weights.toArray())[0].weight).toBe(102.5); });
  it('設定を保存し、別接続からも記録を読み直せる', async () => {
    expect(await getSettings()).toMatchObject(defaultSettings);
    await saveSettings({ ...defaultSettings, calorieTarget: 2200, showPfcDecimals: false, theme: 'dark' });
    await saveMeal(input); await saveWeight('2026-09-06', 102.8);
    const reopened = new MealLogDatabase();
    try { expect(await reopened.meals.count()).toBe(1); expect((await reopened.settings.get('user'))?.calorieTarget).toBe(2200); expect((await reopened.meals.toArray())[0].protein).toBe(52.2); expect(await reopened.weights.count()).toBe(1); } finally { reopened.close(); }
  });
  it('不正な値はDBへ書き込まない', async () => { await expect(saveMeal({ ...input, calories: -1 })).rejects.toThrow(); await expect(saveWeight('2026-02-30', 50)).rejects.toThrow(); await expect(saveSettings({ ...defaultSettings, calorieTarget: 0 })).rejects.toThrow(); expect(await db.meals.count()).toBe(0); });
});

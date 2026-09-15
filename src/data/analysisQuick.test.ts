import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import { analysisPolicy, analysisRange, isAnalysisDay, mealSummary, recentTrends, type MealDay } from '../domain/analysis';
import { quickNutrition, quickPercentages } from '../domain/quickNutrition';
import { defaultSettings } from '../domain/types';
import { shiftDate } from '../domain/date';
import { db } from './db';
import { getSettings, saveSettings } from './repository';
import { quickEntry, saveQuickPercentages } from './catalogRepository';
const today = '2026-09-12', range = analysisRange(7, today, []);
const day = (date: string, calories: number): MealDay => ({ date, calories, protein: calories / 10, fat: calories / 20, carbs: calories / 5, count: 1 });
const context = { date: today, time: '12:00', mealType: 'lunch' as const };
beforeEach(async () => { await db.meals.clear(); await db.settings.clear(); });
it('未保存・従来設定で除外ON/1500と25/30/45を使い、読込で書き換えない', async () => {
  expect(analysisPolicy(await getSettings())).toEqual({ enabled: true, threshold: 1500 });
  expect(quickPercentages(await getSettings())).toEqual({ protein: 25, fat: 30, carbs: 45 });
  expect(await db.settings.count()).toBe(0);
  await saveSettings(defaultSettings);
  const old = await db.settings.get('user');
  expect(analysisPolicy(await getSettings()).threshold).toBe(1500);
  expect(await db.settings.get('user')).toEqual(old);
});
it('1500以下を除外し1501を対象に、グラフ用recordsと記録日数は保持', () => {
  const records = [day(today, 1500), day(shiftDate(today, -1), 1501), day(shiftDate(today, -2), 100)];
  const result = mealSummary(records, range);
  expect(result.records).toEqual(records); expect(result.recordedDays).toBe(3); expect(result.eligibleDays).toBe(1); expect(result.excludedDays).toBe(2);
  expect(result.average).toEqual({ calories: 1501, protein: 150.1, fat: 75.05, carbs: 300.2 });
  expect(isAnalysisDay(records[0])).toBe(false);
  expect(mealSummary(records, range, { enabled: false, threshold: 1500 }).eligibleDays).toBe(3);
});
it('0件・全件除外なら平均はnull（0kcalを生成しない）', () => {
  expect(mealSummary([], range)).toMatchObject({ recordedDays: 0, eligibleDays: 0, average: null });
  expect(mealSummary([day(today, 1500)], range)).toMatchObject({ recordedDays: 1, eligibleDays: 0, excludedDays: 1, average: null });
});
it('前後7日は対象日数4日を要件にし、除外OFFなら元の平均を使う', () => {
  const days = Array.from({ length: 14 }, (_, i) => day(shiftDate(today, -i), i % 7 < 3 ? 2000 : 1500));
  const filtered = recentTrends(days, [], today);
  expect(filtered.current.recordedDays).toBe(7); expect(filtered.current.eligibleDays).toBe(3); expect(filtered.difference).toBeNull();
  expect(recentTrends(days, [], today, { enabled: false, threshold: 1500 }).difference?.calories).toBe(0);
  days[3].calories = 2000; days[10].calories = 2000;
  expect(recentTrends(days, [], today).difference?.calories).toBe(0);
});
it('割合25/30/45を内部で丸めず4/9/4計算', () => {
  const result = quickNutrition(1000, { mode: 'percent', values: quickPercentages(defaultSettings) });
  expect(result.nutrients).toEqual({ calories: 1000, protein: 62.5, fat: 1000 * .3 / 9, carbs: 112.5 });
  expect(result.warning).toBeNull(); expect(result.percentTotal).toBe(100);
});
it('割合合計150%を正規化せず警告だけで保存、次回・再接続でも再利用', async () => {
  const values = { protein: 50, fat: 50, carbs: 50 };
  expect(quickNutrition(900, { mode: 'percent', values }).warning).not.toBeNull();
  const saved = await quickEntry(900, '', context, { mode: 'percent', values });
  expect(saved).toMatchObject({ sourceType: 'manual', calories: 900, protein: 112.5, fat: 50, carbs: 112.5 });
  db.close(); await db.open(); expect(quickPercentages(await getSettings())).toEqual(values);
});
it('割合の入力欄を離れた時の保存で他の設定を保持', async () => {
  await saveSettings({ ...defaultSettings, calorieTarget: 2300, analysisMinimumCalories: 1200, analysisExcludeLowCalories: false });
  await saveQuickPercentages({ protein: 30, fat: 30, carbs: 30 });
  expect(await getSettings()).toMatchObject({ calorieTarget: 2300, analysisMinimumCalories: 1200, analysisExcludeLowCalories: false });
  expect(quickPercentages(await getSettings()).carbs).toBe(30);
});
it('グラムの参考kcal・差分を計算し、大差の警告でも保存可能', async () => {
  const input = { mode: 'grams' as const, values: { protein: 100, fat: 20, carbs: 50 } };
  const result = quickNutrition(500, input);
  expect(result.pfcCalories).toBe(780); expect(result.difference).toBe(280); expect(result.warning).not.toBeNull();
  expect(await quickEntry(500, '自由入力', context, input)).toMatchObject({ calories: 500, ...input.values });
});
it('警告は差150kcal以上かつ20%以上、割合は10ポイント超', () => {
  const g = { mode: 'grams' as const, values: { protein: 200, fat: 0, carbs: 0 } };
  expect(quickNutrition(900, g).warning).toBeNull();
  expect(quickNutrition(950, g).warning).toBeNull();
  expect(quickNutrition(1000, g).warning).not.toBeNull();
  expect(quickNutrition(1000, { mode: 'percent', values: { protein: 30, fat: 30, carbs: 30 } }).warning).toBeNull();
});
it('PFCなし・旧呼び出しは0のまま、新規登録後も過去記録を再計算しない', async () => {
  const old = await quickEntry(800, '', context);
  expect(old).toMatchObject({ protein: 0, fat: 0, carbs: 0 });
  expect(quickNutrition(800, { mode: 'none' }).nutrients).toMatchObject({ protein: 0, fat: 0, carbs: 0 });
  await quickEntry(900, '', context, { mode: 'percent', values: quickPercentages(defaultSettings) });
  expect(await db.meals.get(old.id)).toEqual(old);
});
it('負値・NaN・割合範囲外を拒否し、設定と記録を部分保存しない', async () => {
  for (const value of [-1, NaN, 101]) await expect(quickEntry(900, '', context, { mode: 'percent', values: { protein: value, fat: 30, carbs: 45 } })).rejects.toThrow();
  await expect(saveSettings({ ...defaultSettings, analysisMinimumCalories: -1 })).rejects.toThrow();
  expect(await db.meals.count()).toBe(0); expect(await db.settings.count()).toBe(0);
});

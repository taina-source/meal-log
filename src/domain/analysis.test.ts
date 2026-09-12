import { describe, expect, it } from 'vitest';
import { analysisRange, calendarDay, dailyMeals, dailyWeights, mealSummary, movingWeightAverage, recentTrends, targetDifference, weightSummary } from './analysis';
import { localDate, shiftDate } from './date';
import { defaultSettings, type MealEntry, type WeightEntry } from './types';

function meal(date: string, calories = 500): MealEntry {
  return { id: `${date}-${calories}`, name: 'テスト', restaurant: '', mealType: 'lunch', eatenAt: new Date(`${date}T12:00:00`).toISOString(), createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', sourceType: 'manual', confidence: null, calories, protein: calories / 10, fat: calories / 20, carbs: calories / 5 };
}
const weight = (date: string, value: number, createdAt = `${date}T00:00:00Z`): WeightEntry => ({ id: `${date}-${value}`, date, weight: value, createdAt });
const today = '2026-03-02';
describe('分析の暦日・食事集計', () => {
  it.each([7, 30, 90] as const)('%i日は今日と開始日を含み、前日・明日を含まない', period => {
    const range = analysisRange(period, today, []);
    expect(range.days).toBe(period);
    const days = dailyMeals([meal(shiftDate(range.start, -1)), meal(range.start), meal(today), meal(shiftDate(today, 1))]);
    expect(mealSummary(days, range).records.map(day => day.date)).toEqual([range.start, today]);
  });
  it('全期間は食事と体重の最初〜最後、空データは今日', () => {
    expect(analysisRange('all', today, ['2025-12-31', '2026-03-03', today])).toEqual({ start: '2025-12-31', end: '2026-03-03', days: 63 });
    expect(analysisRange('all', today, [])).toEqual({ start: today, end: today, days: 1 });
  });
  it('複数食事を日別合算し未記録日を除いた平均・現在目標との差を計算する', () => {
    const entries = [meal(today, 500), meal(today, 700), meal(shiftDate(today, -2), 600)];
    const snapshot = structuredClone(entries);
    const summary = mealSummary(dailyMeals(entries), analysisRange(7, today, []));
    expect(summary.recordedDays).toBe(2);
    expect(summary.records.at(-1)).toMatchObject({ calories: 1200, count: 2 });
    expect(summary.average).toEqual({ calories: 900, protein: 90, fat: 45, carbs: 180 });
    expect(targetDifference(summary.average, defaultSettings)).toEqual({ calories: -1500, protein: -90, fat: -25, carbs: -80 });
    expect(targetDifference(summary.average, { ...defaultSettings, calorieTarget: 800 })?.calories).toBe(100);
    expect(entries).toEqual(snapshot);
  });
  it('食事0件は平均なし、記録された0kcalは実際の記録日', () => {
    const range = analysisRange(7, today, []);
    expect(mealSummary([], range)).toEqual({ records: [], recordedDays: 0, average: null });
    expect(targetDifference(null, defaultSettings)).toBeNull();
    expect(mealSummary(dailyMeals([meal(today, 0)]), range).average?.calories).toBe(0);
  });
  it('ローカル深夜の前後を異なる日に振り分け、UTCの日付切取りを使わない', () => {
    const midnight = new Date(2026, 2, 2, 0, 0, 0);
    const previous = new Date(midnight.getTime() - 1);
    const a = { ...meal(today), eatenAt: midnight.toISOString() }, b = { ...meal(today), eatenAt: previous.toISOString() };
    expect(dailyMeals([a, b]).map(day => day.date)).toEqual([localDate(previous), localDate(midnight)]);
    // Fixed instant expectation uses the running device's timezone, not a hard-coded UTC date.
    const instant = new Date('2026-03-01T15:30:00Z');
    expect(dailyMeals([{ ...a, eatenAt: instant.toISOString() }])[0].date).toBe(localDate(instant));
  });
  it('閏日・年跨ぎ・夏時間付近でも暦日数を維持', () => {
    expect(analysisRange(7, '2024-03-01', []).start).toBe('2024-02-24');
    expect(analysisRange(7, '2026-01-02', []).start).toBe('2025-12-27');
    expect(calendarDay('2026-03-10') - calendarDay('2026-03-07')).toBe(3);
  });
});
describe('体重と移動平均', () => {
  it('体重0件・1件は比較なし', () => {
    const range = analysisRange(7, today, []);
    expect(weightSummary([], range)).toEqual({ records: [], first: null, latest: null, change: null });
    const summary = weightSummary(dailyWeights([weight(today, 80)]), range);
    expect(summary.change).toBeNull(); expect(summary.latest).toMatchObject({ weight: 80, average: 80, count: 1 });
  });
  it('同日重複は最新記録だけを使い、元のデータを変更しない', () => {
    const entries = [weight(today, 81, `${today}T10:00:00Z`), weight(today, 80, `${today}T09:00:00Z`)];
    const snapshot = structuredClone(entries);
    expect(dailyWeights(entries)).toEqual([{ date: today, weight: 81 }]); expect(entries).toEqual(snapshot);
  });
  it('7記録ではなく7暦日の平均で欠測を0にしない', () => {
    const days = dailyWeights([weight(shiftDate(today, -7), 200), weight(shiftDate(today, -6), 90), weight(shiftDate(today, -2), 80), weight(today, 70)]);
    const averages = movingWeightAverage(days);
    expect(averages.at(-1)).toMatchObject({ date: today, average: 80, count: 3 });
    expect(averages.map(day => day.date)).toEqual(days.map(day => day.date));
  });
  it('選択期間前の6日を平均に使い、期間外・未来の値は概要に入れない', () => {
    const range = analysisRange(7, today, []);
    const days = dailyWeights([weight(shiftDate(range.start, -1), 84), weight(range.start, 80), weight(today, 78), weight(shiftDate(today, 1), 200)]);
    const summary = weightSummary(days, range);
    expect(summary.first).toMatchObject({ average: 82, count: 2 });
    expect(summary.latest).toMatchObject({ average: 79, count: 2 });
    expect(summary.change).toBe(-2); expect(summary.records).toHaveLength(2);
  });
});
describe('直近7日とその前7日', () => {
  const days = (n: number, offset: number, kcal: number) => Array.from({ length: n }, (_, i) => meal(shiftDate(today, -i - offset), kcal));
  it('両期間4日以上の記録だけで差分を表示する', () => {
    const trend = recentTrends(dailyMeals([...days(4, 0, 1000), ...days(4, 7, 800), meal(shiftDate(today, -14), 9999)]), [], today);
    expect(trend.current.recordedDays).toBe(4); expect(trend.previous.recordedDays).toBe(4);
    expect(trend.difference).toEqual({ calories: 200, protein: 20, fat: 10, carbs: 40 });
    expect(trend.previousRange.end).toBe(shiftDate(today, -7));
  });
  it.each([[3, 4], [4, 3], [0, 0]])('記録日が少ない場合は判定なし（%i / %i）', (a, b) => {
    const trend = recentTrends(dailyMeals([...days(a, 0, 1000), ...days(b, 7, 800)]), [], today);
    expect(trend.difference).toBeNull();
  });
});

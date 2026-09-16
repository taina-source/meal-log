import { expect, it } from 'vitest';
import { maintenanceCalculation, maintenanceEstimate, maintenanceSufficiency, median, theilSenSlope } from './maintenance';
import { analysisPolicy, dailyMeals, dailyWeights, type MealDay, type WeightDay } from './analysis';
import { shiftDate } from './date';
import type { MealEntry } from './types';
const end = '2026-09-17', start = '2026-08-19';
const meals = (count = 30, calories = 2200): MealDay[] => Array.from({ length: count }, (_, i) => ({ date: shiftDate(start, i), calories, protein: 100, fat: 70, carbs: 250, count: 1 }));
const weights = (slope = 0, offsets = Array.from({ length: 30 }, (_, i) => i)): WeightDay[] => offsets.map(i => ({ date: shiftDate(start, i), weight: 100 + slope * i }));

it('中央値は偶数中央2値の平均・入力配列を変更しない', () => {
  const a = [9, 1, 4, 2]; expect(median(a)).toBe(3); expect(a).toEqual([9, 1, 4, 2]); expect(median([5, 1, 3])).toBe(3);
  expect(median([])).toBeNull(); expect(median([Infinity])).toBeNull(); expect(median([NaN])).toBeNull();
});
it.each([-0.05, 0.05, 0])('一定変化%sのTheil–Senと維持カロリー', slope => {
  const result = maintenanceEstimate(meals(), weights(slope)); expect(theilSenSlope(weights(slope))).toBeCloseTo(slope, 12);
  expect(result.raw).toBeCloseTo(2200 - slope * 7700, 8); expect(result.status).toBe('推定可能');
});
it('1つの外れ値があっても一定のトレンドを保つ', () => {
  const points = weights(-0.05); points[15].weight += 10; expect(theilSenSlope(points)).toBeCloseTo(-0.05, 12);
});
it('不規則な間隔は暦日差で割る・入力順に依存しない', () => expect(theilSenSlope(weights(-0.1, [29, 0, 4, 9, 21]))).toBeCloseTo(-0.1, 12));
it('単点・空・同日のみではトレンドなし、同日ペアを除外', () => {
  expect(theilSenSlope([])).toBeNull(); expect(theilSenSlope(weights(0, [0]))).toBeNull(); expect(theilSenSlope(weights(0, [0, 0]))).toBeNull();
  expect(theilSenSlope(weights(-0.1, [0, 0, 10]))).toBeCloseTo(-0.1, 12);
  expect(theilSenSlope([{ date: start, weight: NaN }])).toBeNull();
});
it.each([[2585, 2600], [2520, 2500]])('表示だけ%s→%sに丸める', (raw, rounded) => {
  expect(maintenanceCalculation(raw, 0, 100)).toMatchObject({ raw, rounded });
});
it.each([[20, 'データ不足'], [21, '参考'], [23, '参考'], [24, '十分']] as const)('食事%d/30の充足度%s', (count, expected) => {
  expect(maintenanceEstimate(meals(count), weights()).sufficiency).toBe(expected);
});
it.each([[7, 29, 'データ不足'], [8, 20, 'データ不足'], [8, 21, '参考'], [14, 27, '参考'], [13, 28, '参考'], [14, 28, '十分']] as const)('体重%d日・間隔%d日の充足度%s', (count, span, expected) => {
  const offsets = Array.from({ length: count }, (_, i) => 29 - span + Math.floor(i * span / (count - 1)));
  expect(maintenanceEstimate(meals(), weights(0, offsets)).sufficiency).toBe(expected);
});
it('全最低条件は参考、片方の不足でも推定を出さない', () => {
  expect(maintenanceSufficiency(21, 8, 21)).toBe('参考'); expect(maintenanceSufficiency(24, 14, 28)).toBe('十分');
  expect(maintenanceEstimate(meals(20), weights()).rounded).toBeNull(); expect(maintenanceEstimate(meals(), weights(0, [0, 29])).rounded).toBeNull();
});
it.each([-1, 1])('週1.5%%ちょうどは保留せず、超過時は保留（方向%s）', direction => {
  expect(maintenanceCalculation(2200, direction * 1.5 / 7, 100).status).toBe('推定可能');
  expect(maintenanceCalculation(2200, direction * 1.5001 / 7, 100)).toMatchObject({ status: '推定保留', raw: null, rounded: null });
});
it('急変ガードは30日間の体重中央値を使い、充足度と独立', () => {
  const result = maintenanceEstimate(meals(), weights(-0.25));
  expect(result.weeklyChangePercent).toBeCloseTo(1.75 / 96.375 * 100); expect(result.status).toBe('推定保留'); expect(result.sufficiency).toBe('十分');
});
it.each([[NaN, 0], [Infinity, 0], [0, 0], [-1, 0], [100, 1], [2200, Infinity]])('異常な計算%s/%sを拒否しclampしない', (intake, slope) => {
  expect(maintenanceCalculation(intake, slope, 100)).toMatchObject({ status: '推定不可', raw: null, rounded: null });
});
it('欠損・1500以下を分母から除外し、1501を含め既存OFF設定も反映', () => {
  const input = meals(24, 1501); input[0].calories = 1500; input[1].calories = 1000;
  const normal = maintenanceEstimate(input, weights()); expect(normal.eligibleDays).toBe(22); expect(normal.averageIntakeKcal).toBe(1501);
  const off = maintenanceEstimate(input, weights(), analysisPolicy({ analysisExcludeLowCalories: false })); expect(off.eligibleDays).toBe(24); expect(off.averageIntakeKcal).toBeCloseTo((22 * 1501 + 2500) / 24);
  expect(maintenanceEstimate(input, weights(), analysisPolicy({ analysisMinimumCalories: 2000 })).eligibleDays).toBe(0);
});
it('最新体重日で30暦日を固定、期間の前後の食事・古い体重を除外', () => {
  const input = [...meals(), { ...meals(1)[0], date: shiftDate(start, -1), calories: 9999 }, { ...meals(1)[0], date: shiftDate(end, 1), calories: 9999 }];
  const result = maintenanceEstimate(input, [...weights(), { date: shiftDate(start, -1), weight: 200 }]);
  expect(result.range).toEqual({ start, end, days: 30 }); expect(result.averageIntakeKcal).toBe(2200); expect(result.weightDays).toBe(30);
});
it('旧体重・同日最新選択・ローカル日付集計を再利用し補助指標を計算しない', () => {
  const records = weights().map((w, i) => ({ id: String(i), date: w.date, weight: w.weight, createdAt: `${w.date}T00:00:00Z` }));
  const withAux = [...records, { id: 'aux', date: '2026-10-01', createdAt: '2026-10-01T00:00:00Z', bodyFatPercent: 20, waistCm: 90 }, { ...records[0], id: 'latest', weight: 100, createdAt: `${start}T01:00:00Z` }];
  const meal = { id: 'local', name: '試験', restaurant: '', calories: 2200, protein: 100, fat: 70, carbs: 250, mealType: 'lunch', sourceType: 'manual', confidence: null, eatenAt: new Date(`${start}T00:01:00`).toISOString(), createdAt: '', updatedAt: '' } as MealEntry;
  expect(dailyMeals([meal])[0].date).toBe(start);
  const before = structuredClone(withAux); expect(maintenanceEstimate(meals(), dailyWeights(withAux))).toEqual(maintenanceEstimate(meals(), dailyWeights(records))); expect(withAux).toEqual(before);
});
it('食事・体重0件や体重1件は不足理由を返す', () => {
  const empty = maintenanceEstimate([], []); expect(empty.range).toBeNull(); expect(empty.status).toBe('データ不足'); expect(empty.reasons).toContain('体重記録がありません。');
  expect(maintenanceEstimate(meals(), weights(0, [29])).reasons).toContain('体重記録が8日以上必要です（現在1日）。');
});

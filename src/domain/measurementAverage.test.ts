import { expect, it } from 'vitest';
import { calendarMovingAverage, dateRange, within, movingWeightAverage } from './analysis';
import { measurementSeries } from './measurements';
import type { WeightEntry } from './types';
const rows: WeightEntry[] = [
  { id: 'a', date: '2026-09-09', bodyFatPercent: 50, createdAt: '2026-09-09T00:00:00Z' },
  { id: 'b', date: '2026-09-10', bodyFatPercent: 20, waistCm: 90, createdAt: '2026-09-10T00:00:00Z' },
  { id: 'c', date: '2026-09-12', bodyFatPercent: 22, createdAt: '2026-09-12T00:00:00Z' },
  { id: 'd', date: '2026-09-16', bodyFatPercent: 24, weightKg: 80, createdAt: '2026-09-16T00:00:00Z' },
  { id: 'e', date: '2026-09-17', waistCm: 88, createdAt: '2026-09-17T00:00:00Z' },
];
it('体脂肪は7暦日内の実測3件のみ平均し、直前の窓外値を除く', () => {
  const result = calendarMovingAverage(measurementSeries(rows, 'bodyFatPercent'));
  expect(result.at(-1)).toEqual({ date: '2026-09-16', value: 24, average: 22, count: 3 });
  expect(result.map(p => p.date)).toEqual(['2026-09-09','2026-09-10','2026-09-12','2026-09-16']);
});
it('ウエストは独立し8暦日前を除外、1件でも平均可能', () => {
  expect(calendarMovingAverage(measurementSeries(rows, 'waistCm'))).toEqual([
    { date: '2026-09-10', value: 90, average: 90, count: 1 },
    { date: '2026-09-17', value: 88, average: 88, count: 1 },
  ]);
});
it('期間先頭直前6日を参照するが期間外点は表示しない', () => {
  const range = dateRange('2026-09-16', '2026-09-22');
  const result = calendarMovingAverage(measurementSeries(rows, 'bodyFatPercent')).filter(p => within(p.date, range));
  expect(result).toEqual([{ date: '2026-09-16', value: 24, average: 22, count: 3 }]);
});
it('2件の平均は内部で丸めず入力を変更しない', () => {
  const points = [{ date: '2026-09-10', value: 20.12 }, { date: '2026-09-12', value: 22.13 }];
  const copy = structuredClone(points);
  expect(calendarMovingAverage(points).at(-1)?.average).toBe((20.12 + 22.13) / 2);
  expect(points).toEqual(copy);
});
it('空・非有限値を安全に除外し0補完しない', () => {
  expect(calendarMovingAverage([])).toEqual([]);
  expect(calendarMovingAverage([{ date: '2026-09-10', value: NaN }, { date: '2026-09-11', value: Infinity }, { date: '2026-09-12', value: 24 }])).toEqual([{ date: '2026-09-12', value: 24, average: 24, count: 1 }]);
});
it('暦日差を使いDST切替をまたいでも7日境界を維持', () => {
  expect(calendarMovingAverage([{ date: '2026-03-07', value: 20 }, { date: '2026-03-13', value: 24 }, { date: '2026-03-14', value: 26 }]).map(p => p.average)).toEqual([20,22,25]);
});
it('体重wrapperは既存shapeと計算値を維持', () => {
  expect(movingWeightAverage([{ date: '2026-09-10', weight: 80 }, { date: '2026-09-16', weight: 82 }])).toEqual([{ date: '2026-09-10', weight: 80, average: 80, count: 1 }, { date: '2026-09-16', weight: 82, average: 81, count: 2 }]);
});

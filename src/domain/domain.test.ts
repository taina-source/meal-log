import { describe, expect, it } from 'vitest';
import { inferMealType, remainingLabel, sumNutrients, formatNumber } from './nutrition';
import { dayBounds, localDate, shiftDate } from './date';
import { validateMeal, validateSettings, validLocalDateTime } from './validation';
import { defaultSettings, type MealInput } from './types';
const meal: MealInput = { name: 'ご飯', calories: 100, protein: 0, fat: 0, carbs: 0, mealType: 'lunch', eatenAt: '2026-09-06T03:00:00.000Z' };
describe('日次計算と表示', () => {
  it('小数を保持して合算する', () => { expect(sumNutrients([{ calories: 120.1, protein: .1, fat: 1, carbs: 2 }, { calories: 100.2, protein: .2, fat: 3, carbs: 4 }])).toEqual({ calories: 220.3, protein: .3, fat: 4, carbs: 6 }); });
  it('超過・残り・ゼロを表現する', () => { expect(remainingLabel(82, 70, 'g')).toBe('12gオーバー'); expect(remainingLabel(62, 70, 'g')).toBe('あと8g'); expect(remainingLabel(70, 70, 'g')).toBe('あと0g'); expect(remainingLabel(.3, .1 + .2, 'g', true)).toBe('あと0g'); });
  it('表示を丸めても元データは変わらない', () => { const value = 39.2; expect(formatNumber(value, false)).toBe('39'); expect(formatNumber(value, true)).toBe('39.2'); expect(value).toBe(39.2); });
  it.each([[0, 'snack'], [3, 'snack'], [4, 'breakfast'], [10, 'breakfast'], [11, 'lunch'], [15, 'lunch'], [16, 'dinner'], [21, 'dinner'], [22, 'snack'], [23, 'snack']])('時刻 %i の区分は %s', (hour, expected) => { expect(inferMealType(Number(hour))).toBe(expected); });
});
describe('入力検証', () => {
  it('PFCゼロ・カロリーゼロを許可する', () => expect(validateMeal({ ...meal, calories: 0 })).toBeUndefined());
  it('名前・マイナス・非数・異常値を拒否する', () => { expect(validateMeal({ ...meal, name: ' ' })).toBeTruthy(); expect(validateMeal({ ...meal, protein: -1 })).toBeTruthy(); expect(validateMeal({ ...meal, calories: NaN })).toBeTruthy(); expect(validateMeal({ ...meal, calories: Infinity })).toBeTruthy(); expect(validateMeal({ ...meal, carbs: 2001 })).toBeTruthy(); });
  it('日付・時刻の繰り上がりと不正値を拒否する', () => { expect(validLocalDateTime('2026-02-30', '12:00')).toBe(false); expect(validLocalDateTime('2026-09-06', '24:00')).toBe(false); expect(validLocalDateTime('', '12:00')).toBe(false); expect(validLocalDateTime('2026-09-06', '12:00')).toBe(true); });
  it('目標カロリーゼロを拒否しPFC目標ゼロは許可する', () => { expect(validateSettings({ ...defaultSettings, calorieTarget: 0 })).toBeTruthy(); expect(validateSettings({ ...defaultSettings, proteinTarget: 0 })).toBeUndefined(); expect(validateSettings({ ...defaultSettings, targetWeight: -1 })).toBeTruthy(); });
});
describe('ローカル日付', () => {
  it('月・年の境界を移動する', () => { expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31'); expect(shiftDate('2024-02-28', 1)).toBe('2024-02-29'); });
  it('端末の暦日に対応するUTC境界を作る', () => { const [start, end] = dayBounds('2026-09-06'); expect(localDate(new Date(start))).toBe('2026-09-06'); expect(localDate(new Date(end))).toBe('2026-09-07'); expect(new Date(start).getHours()).toBe(0); });
});

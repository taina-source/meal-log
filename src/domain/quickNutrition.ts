import type { Nutrients, UserSettings } from './types';
import { numericError } from './validation';
export type PfcValues = Omit<Nutrients, 'calories'>;
export type QuickPfc = { mode: 'none' } | { mode: 'percent' | 'grams'; values: PfcValues };
export function quickPercentages(settings: UserSettings): PfcValues {
  return { ...(settings.quickPfcPercentages ?? { protein: 25, fat: 30, carbs: 45 }) };
}
export function quickNutrition(calories: number, input: QuickPfc) {
  const calorieError = numericError(calories, 'カロリー', 20000);
  if (calorieError) throw new Error(calorieError);
  const nutrients: Nutrients = { calories, protein: 0, fat: 0, carbs: 0 };
  if (input.mode !== 'none') for (const key of ['protein', 'fat', 'carbs'] as const) {
    const error = numericError(input.values[key], key, input.mode === 'percent' ? 100 : 2000);
    if (error) throw new Error(error);
    nutrients[key] = input.mode === 'percent' ? calories * input.values[key] / 100 / (key === 'fat' ? 9 : 4) : input.values[key];
  }
  const pfcCalories = nutrients.protein * 4 + nutrients.fat * 9 + nutrients.carbs * 4;
  const difference = pfcCalories - calories;
  const percentTotal = input.mode === 'percent' ? input.values.protein + input.values.fat + input.values.carbs : null;
  const warning = input.mode === 'percent' && Math.abs(percentTotal! - 100) > 10
    ? '割合の合計が100%から10ポイント超ずれています。内容を確認してください（登録は可能です）。'
    : input.mode === 'grams' && Math.abs(difference) >= 150 && Math.abs(difference) >= calories * .2
      ? '入力カロリーとPFCの差が大きいため確認してください（登録は可能です）。' : null;
  return { nutrients, pfcCalories, difference, percentTotal, warning };
}

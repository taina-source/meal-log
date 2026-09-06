import { mealTypes, type MealInput, type UserSettings } from './types';
import { localDate } from './date';
export function numericError(value: number, label: string, max: number, min = 0): string | undefined {
  if (!Number.isFinite(value) || value < min || value > max) return `${label}は${min}〜${max.toLocaleString('ja-JP')}の数値で入力してください。`;
}
export function validateMeal(meal: MealInput): string | undefined {
  if (!meal.name.trim()) return '食事名を入力してください。';
  if (meal.name.trim().length > 100) return '食事名は100文字以内で入力してください。';
  for (const [value, label, max] of [[meal.calories, 'カロリー', 20000], [meal.protein, 'たんぱく質', 2000], [meal.fat, '脂質', 2000], [meal.carbs, '炭水化物', 2000]] as const) {
    const error = numericError(value, label, max);
    if (error) return error;
  }
  if (!mealTypes.includes(meal.mealType)) return '食事区分を選んでください。';
  const date = new Date(meal.eatenAt);
  if (!Number.isFinite(date.getTime()) || date.getFullYear() < 1900 || date.getFullYear() > 2100) return '日付・時刻を正しく入力してください（1900〜2100年）。';
}
export function validLocalDateTime(date: string, time: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return false;
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isFinite(parsed.getTime()) && localDate(parsed) === date && parsed.getFullYear() >= 1900 && parsed.getFullYear() <= 2100;
}
export function validateSettings(settings: UserSettings): string | undefined {
  for (const [value, label, max, min] of [[settings.calorieTarget, '目標カロリー', 20000, 1], [settings.proteinTarget, 'P目標', 2000, 0], [settings.fatTarget, 'F目標', 2000, 0], [settings.carbsTarget, 'C目標', 2000, 0]] as const) {
    const error = numericError(value, label, max, min);
    if (error) return error;
  }
  if (settings.targetWeight !== null) return numericError(settings.targetWeight, '目標体重', 500, 1);
}

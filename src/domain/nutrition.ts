import type { MealType, Nutrients } from './types';
export const emptyTotals: Nutrients = { calories: 0, protein: 0, fat: 0, carbs: 0 };
export function sumNutrients(entries: Nutrients[]): Nutrients {
  const total = entries.reduce((sum, entry) => ({ calories: sum.calories + entry.calories, protein: sum.protein + entry.protein, fat: sum.fat + entry.fat, carbs: sum.carbs + entry.carbs }), { ...emptyTotals });
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  return { calories: round(total.calories), protein: round(total.protein), fat: round(total.fat), carbs: round(total.carbs) };
}
export function inferMealType(hour = new Date().getHours()): MealType {
  if (hour >= 4 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 22) return 'dinner';
  return 'snack';
}
export function formatNumber(value: number, decimals = false): string {
  return new Intl.NumberFormat('ja-JP', { maximumFractionDigits: decimals ? 1 : 0 }).format(value);
}
export function remainingLabel(used: number, target: number, unit: string, decimals = false): string {
  const difference = Math.round((target - used) * 1e6) / 1e6;
  return difference < 0 ? `${formatNumber(-difference, decimals)}${unit}オーバー` : `あと${formatNumber(difference, decimals)}${unit}`;
}

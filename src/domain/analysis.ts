import { localDate, shiftDate } from './date';
import { emptyTotals, sumNutrients } from './nutrition';
import type { MealEntry, Nutrients, UserSettings, WeightEntry } from './types';

export type AnalysisPeriod = 7 | 30 | 90 | 'all';
export interface DateRange { start: string; end: string; days: number }
export interface MealDay extends Nutrients { date: string; count: number }
export interface WeightDay { date: string; weight: number }
export interface AverageWeightDay extends WeightDay { average: number; count: number }

// Calendar distance, independent of 23/25-hour daylight-saving days.
export function calendarDay(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day); value.setUTCHours(0, 0, 0, 0);
  return value.getTime() / 86400000;
}
export function dateRange(start: string, end: string): DateRange {
  return { start, end, days: calendarDay(end) - calendarDay(start) + 1 };
}
export function analysisRange(period: AnalysisPeriod, today: string, dates: string[]): DateRange {
  if (period !== 'all') return dateRange(shiftDate(today, 1 - period), today);
  if (!dates.length) return dateRange(today, today);
  let start = dates[0], end = dates[0];
  for (const date of dates) { if (date < start) start = date; if (date > end) end = date; }
  return dateRange(start, end);
}
export function within(date: string, range: DateRange): boolean { return date >= range.start && date <= range.end; }

export function dailyMeals(meals: MealEntry[]): MealDay[] {
  const days = new Map<string, MealDay>();
  for (const meal of meals) {
    const date = localDate(new Date(meal.eatenAt));
    const previous = days.get(date) ?? { ...emptyTotals, date, count: 0 };
    days.set(date, { ...sumNutrients([previous, meal]), date, count: previous.count + 1 });
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function mealSummary(days: MealDay[], range: DateRange) {
  const records = days.filter(day => within(day.date, range));
  const total = sumNutrients(records);
  const average: Nutrients | null = records.length ? {
    calories: total.calories / records.length, protein: total.protein / records.length,
    fat: total.fat / records.length, carbs: total.carbs / records.length,
  } : null;
  return { records, recordedDays: records.length, average };
}
export function targetDifference(average: Nutrients | null, settings: UserSettings): Nutrients | null {
  if (!average) return null;
  return { calories: average.calories - settings.calorieTarget, protein: average.protein - settings.proteinTarget,
    fat: average.fat - settings.fatTarget, carbs: average.carbs - settings.carbsTarget };
}
export function dailyWeights(entries: WeightEntry[]): WeightDay[] {
  // The current DB has a unique date index. Keep this defensive rule for supplied duplicate data.
  const latest = new Map<string, WeightEntry>();
  for (const entry of entries) {
    const old = latest.get(entry.date);
    if (!old || entry.createdAt > old.createdAt || (entry.createdAt === old.createdAt && entry.id > old.id)) latest.set(entry.date, entry);
  }
  return [...latest.values()].sort((a, b) => a.date.localeCompare(b.date)).map(({ date, weight }) => ({ date, weight }));
}
export function movingWeightAverage(days: WeightDay[]): AverageWeightDay[] {
  // Evaluate at recorded dates only: no zero-filled days or extrapolated future points.
  let left = 0, total = 0;
  return days.map((day, right) => {
    total += day.weight;
    while (calendarDay(days[left].date) < calendarDay(day.date) - 6) total -= days[left++].weight;
    const count = right - left + 1;
    return { ...day, average: total / count, count };
  });
}
export function weightSummary(days: WeightDay[], range: DateRange) {
  const records = movingWeightAverage(days).filter(day => within(day.date, range));
  const first = records[0] ?? null, latest = records.at(-1) ?? null;
  return { records, first, latest, change: records.length >= 2 ? latest!.weight - first!.weight : null };
}
export function recentTrends(days: MealDay[], weights: WeightDay[], today: string) {
  const currentRange = analysisRange(7, today, []);
  const previousRange = dateRange(shiftDate(today, -13), shiftDate(today, -7));
  const current = mealSummary(days, currentRange), previous = mealSummary(days, previousRange);
  const enough = current.recordedDays >= 4 && previous.recordedDays >= 4;
  const difference: Nutrients | null = enough && current.average && previous.average ? {
    calories: current.average.calories - previous.average.calories,
    protein: current.average.protein - previous.average.protein,
    fat: current.average.fat - previous.average.fat,
    carbs: current.average.carbs - previous.average.carbs,
  } : null;
  return { currentRange, previousRange, current, previous, difference, weight: weightSummary(weights, currentRange) };
}

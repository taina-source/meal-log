import { localDate } from './date';
import { measurementValues } from './measurements';
import type { MealEntry, WeightEntry } from './types';

export function shiftMonth(month: string, offset: number): string {
  const date = new Date(`${month}-01T12:00:00`);
  date.setMonth(date.getMonth() + offset);
  return localDate(date).slice(0, 7);
}
export interface CalendarDay { date: string; mealCount: number; calories: number | null; hasMeasurement: boolean }
export function buildMonthCalendar(month: string, meals: MealEntry[], measurements: WeightEntry[]) {
  const first = new Date(`${month}-01T12:00:00`);
  const last = new Date(`${shiftMonth(month, 1)}-01T12:00:00`);
  last.setDate(0);
  const days: CalendarDay[] = Array.from({ length: last.getDate() }, (_, i) => ({
    date: `${month}-${String(i + 1).padStart(2, '0')}`, mealCount: 0, calories: null, hasMeasurement: false,
  }));
  const byDate = new Map(days.map(day => [day.date, day]));
  for (const meal of meals) {
    const day = byDate.get(localDate(new Date(meal.eatenAt)));
    if (day) { day.mealCount++; day.calories = (day.calories ?? 0) + meal.calories; }
  }
  for (const entry of measurements) {
    const day = byDate.get(entry.date);
    if (day && Object.values(measurementValues(entry)).some(value => Number.isFinite(value) && value > 0)) day.hasMeasurement = true;
  }
  const cells: (CalendarDay | null)[] = Array(first.getDay()).fill(null);
  cells.push(...days);
  while (cells.length % 7) cells.push(null);
  return cells;
}

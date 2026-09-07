import { db } from './db';
import { createId } from './id';
import { dayBounds, localTime, shiftDate } from '../domain/date';
import { validLocalDateTime } from '../domain/validation';
import type { MealType } from '../domain/types';
export async function copyPreviousDay(targetDate: string, types: MealType[]): Promise<{ copied: number; skipped: number }> {
  if (!validLocalDateTime(targetDate, '12:00') || !validLocalDateTime(shiftDate(targetDate, -1), '12:00')) throw new Error('日付が正しくありません。');
  const [start, end] = dayBounds(shiftDate(targetDate, -1));
  return db.transaction('rw', db.meals, async () => {
    const source = (await db.meals.where('eatenAt').between(start, end, true, false).toArray()).filter(meal => types.includes(meal.mealType));
    let copied = 0, skipped = 0;
    const now = new Date().toISOString();
    const setRuns = new Map<string, string>();
    for (const meal of source) {
      if (await db.meals.where('[copiedFromId+copyTargetDate]').equals([meal.id, targetDate]).count()) { skipped++; continue; }
      if (meal.setRunId && !setRuns.has(meal.setRunId)) setRuns.set(meal.setRunId, createId());
      await db.meals.add({ ...structuredClone(meal), id: createId(), eatenAt: new Date(`${targetDate}T${localTime(new Date(meal.eatenAt))}:00`).toISOString(), createdAt: now, updatedAt: now, copiedFromId: meal.id, copyTargetDate: targetDate, setRunId: meal.setRunId ? setRuns.get(meal.setRunId) : undefined });
      copied++;
    }
    return { copied, skipped };
  });
}

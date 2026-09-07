import { db } from './db';
import { createId } from './id';
import { defaultSettings, type MealEntry, type MealInput, type UserSettings } from '../domain/types';
import { dayBounds } from '../domain/date';
import { numericError, validateMeal, validateSettings, validLocalDateTime } from '../domain/validation';
export async function getSettings(): Promise<UserSettings> {
  return (await db.settings.get('user')) ?? { ...defaultSettings };
}
export async function saveSettings(settings: UserSettings): Promise<void> {
  const error = validateSettings(settings);
  if (error) throw new Error(error);
  await db.settings.put({ ...settings, id: 'user' });
}
export async function getDayMeals(date: string): Promise<MealEntry[]> {
  const [start, end] = dayBounds(date);
  return db.meals.where('eatenAt').between(start, end, true, false).toArray();
}
export async function saveMeal(input: MealInput, existingId?: string): Promise<MealEntry> {
  const error = validateMeal(input);
  if (error) throw new Error(error);
  return db.transaction('rw', db.meals, async () => {
    const existing = existingId ? await db.meals.get(existingId) : undefined;
    if (existingId && !existing) throw new Error('この食事はすでに削除されています。');
    const now = new Date().toISOString();
    const entry: MealEntry = { ...existing, ...input, name: input.name.trim(), eatenAt: new Date(input.eatenAt).toISOString(), id: existing?.id ?? createId(), restaurant: existing?.restaurant ?? '', sourceType: existing?.sourceType ?? 'manual', confidence: existing?.confidence ?? null, createdAt: existing?.createdAt ?? now, updatedAt: now };
    await db.meals.put(entry);
    return entry;
  });
}
export async function deleteMeal(id: string): Promise<void> { await db.meals.delete(id); }
export async function saveWeight(date: string, weight: number): Promise<void> {
  const error = numericError(weight, '体重', 500, 1);
  if (error) throw new Error(error);
  if (!validLocalDateTime(date, '12:00')) throw new Error('日付が正しくありません。');
  await db.transaction('rw', db.weights, async () => {
    const existing = await db.weights.where('date').equals(date).first();
    await db.weights.put({ id: existing?.id ?? createId(), date, weight, createdAt: existing?.createdAt ?? new Date().toISOString() });
  });
}
export function storageError(error: unknown): string {
  if (error instanceof Error && !['QuotaExceededError', 'UnknownError', 'InvalidStateError'].includes(error.name)) return error.message;
  return '端末に保存できませんでした。空き容量やSafariの保存設定を確認して、もう一度お試しください。';
}

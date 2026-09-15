import { db } from './db';
import { createId } from './id';
import { favoriteId } from './catalogRepository';
import { savedMealKind } from '../domain/reuseMeals';
import { validateMeal, validLocalDateTime } from '../domain/validation';
import { validateChatgptMeal } from '../domain/chatgpt';
import type { MealEntry } from '../domain/types';
import type { MealContext } from './catalogRepository';

export function savedMealFavoriteId(meal: MealEntry) { const kind = savedMealKind(meal); return kind ? favoriteId(kind, meal.id, 1) : ''; }
export async function favoriteSavedMeal(meal: MealEntry) {
  const kind = savedMealKind(meal); if (!kind) throw new Error('この記録は専用カテゴリから再利用してください。');
  const error = kind === 'chatgptMeal' ? validateChatgptMeal(meal) : validateMeal(meal); if (error) throw new Error(error);
  const id = savedMealFavoriteId(meal);
  return db.transaction('rw', db.favorites, async () => {
    const existing = await db.favorites.get(id); if (existing) return existing;
    const favorite = { id, kind, sourceId: meal.id, quantity: 1, createdAt: new Date().toISOString(), mealSnapshot: structuredClone(meal) };
    await db.favorites.add(favorite); return favorite;
  });
}
export async function reuseSavedMeals(originals: MealEntry[], edited: MealEntry[], context: MealContext) {
  if (!originals.length || originals.length !== edited.length || originals.length > 20) throw new Error('1〜20品で登録してください。');
  if (!validLocalDateTime(context.date, context.time)) throw new Error('日時を確認してください。');
  const now = new Date().toISOString(), importId = createId();
  const entries = originals.map((original, index): MealEntry => {
    const kind = savedMealKind(original); if (!kind) throw new Error('対象外の記録です。');
    const draft = edited[index];
    // Allow only final value edits. Provenance and immutable snapshots always come from the original.
    const entry = { ...structuredClone(original), name: draft.name.trim(), restaurant: draft.restaurant,
      calories: draft.calories, protein: draft.protein, fat: draft.fat, carbs: draft.carbs, quantity: draft.quantity,
      id: createId(), mealType: context.mealType, eatenAt: new Date(`${context.date}T${context.time}:00`).toISOString(), createdAt: now, updatedAt: now };
    const error = kind === 'chatgptMeal' ? validateChatgptMeal(entry) : validateMeal(entry); if (error) throw new Error(error);
    if (entry.quantity !== undefined && (!Number.isFinite(entry.quantity) || entry.quantity <= 0)) throw new Error('数量は0より大きい数値にしてください。');
    delete entry.copiedFromId; delete entry.copyTargetDate;
    if (kind === 'chatgptMeal') {
      entry.chatgptImportId = importId;
      if ((['name', 'restaurant', 'quantity', 'calories', 'protein', 'fat', 'carbs'] as const).some(key => draft[key] !== original[key])) {
        entry.chatgptUserModified = true; entry.chatgptModifiedBeforeSave = true;
      }
    }
    return entry;
  });
  await db.transaction('rw', db.meals, () => db.meals.bulkAdd(entries));
  return entries;
}

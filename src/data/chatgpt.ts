import { db } from './db';
import { createId } from './id';
import { chatgptModified, chatgptTotals, normalizeChatgptItem, type ChatgptItem, type ImportReceipt } from '../domain/chatgpt';
import { mealTypes, type MealEntry, type MealType } from '../domain/types';
import { validLocalDateTime } from '../domain/validation';

export async function registerChatgpt(receipt: ImportReceipt, edited: ChatgptItem[], context: { date: string; time: string; mealType: MealType }): Promise<MealEntry[]> {
  if (!receipt.payload || receipt.payload.schemaVersion !== 1 || receipt.payload.type !== 'meal-log-chatgpt' || receipt.payload.items.length !== edited.length || !Number.isFinite(Date.parse(receipt.importedAt))) throw new Error('元の取り込み情報を読み直してください。');
  if (!validLocalDateTime(context.date, context.time) || !mealTypes.includes(context.mealType)) throw new Error('食事区分・日付・時刻を確認してください。');
  chatgptTotals(edited);
  const now = new Date().toISOString(), group = createId();
  const entries = edited.map((draft, index): MealEntry => {
    const item = normalizeChatgptItem(draft), original = normalizeChatgptItem(receipt.payload!.items[index]);
    const { sourceType: declaredSourceType, ...snapshot } = original;
    return { ...chatgptTotals([item]), id: createId(), name: item.name, restaurant: item.restaurant,
      mealType: context.mealType, eatenAt: new Date(`${context.date}T${context.time}:00`).toISOString(), createdAt: now, updatedAt: now,
      sourceType: 'chatgpt', confidence: null, quantity: item.quantity, unit: 'item', chatgptUnit: item.unit, chatgptImportId: group,
      chatgptSnapshot: { ...snapshot, declaredSourceType, schemaVersion: 1, importedAt: receipt.importedAt }, chatgptUserModified: chatgptModified(original, item) };
  });
  await db.transaction('rw', db.meals, async () => { await db.meals.bulkAdd(entries); });
  return entries;
}

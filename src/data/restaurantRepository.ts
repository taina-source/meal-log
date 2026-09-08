import type { RestaurantCartLine } from '../domain/catalog';
import type { MealEntry } from '../domain/types';
import type { MealContext } from './catalogRepository';
import { restaurants } from './restaurants';
import { db } from './db';
import { createId } from './id';
import { completeNutrients, menuSourceType, validQuantity } from '../domain/restaurantMenus';
import { scaleNutrients } from '../domain/foods';
import { validateMeal, validLocalDateTime } from '../domain/validation';
export async function registerRestaurantOrder(lines: RestaurantCartLine[], context: MealContext): Promise<MealEntry[]> {
  if (!validLocalDateTime(context.date, context.time)) throw new Error('日付・時刻を正しく入力してください。');
  if (!lines.length || lines.length > 100) throw new Error('1〜100種類の商品を選択してください。');
  if (new Set(lines.map(line => line.item.id)).size !== lines.length) throw new Error('同じ商品は数量で指定してください。');
  const now = new Date().toISOString(), orderId = createId();
  const entries = lines.map(({ item, quantity }): MealEntry => {
    const restaurant = restaurants.find(store => store.id === item.restaurantId);
    if (!restaurant) throw new Error('店舗が見つかりません。');
    const entry: MealEntry = {
      ...scaleNutrients(completeNutrients(item), validQuantity(quantity)), id: createId(),
      name: [item.name, item.variantName].filter(Boolean).join(' / '), restaurant: restaurant.name,
      restaurantId: restaurant.id, restaurantName: restaurant.name, restaurantOrderId: orderId,
      mealType: context.mealType, eatenAt: new Date(`${context.date}T${context.time}:00`).toISOString(), createdAt: now, updatedAt: now,
      sourceType: menuSourceType(item), confidence: null, sourceId: item.id, sourceVersion: item.sourceVersion, quantity, unit: 'item',
      restaurantSnapshot: structuredClone(item), nutrientProvenance: structuredClone(item.nutrientProvenance), notes: [...item.notes],
    };
    const error = validateMeal(entry); if (error) throw new Error(error);
    return entry;
  });
  await db.transaction('rw', db.meals, async () => { await db.meals.bulkAdd(entries); });
  return entries;
}

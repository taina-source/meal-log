import type { Restaurant, RestaurantCartLine, RestaurantMenuItem } from './catalog';
import type { MealEntry, Nutrients, SourceType } from './types';
import { normalizeSearch, scaleNutrients } from './foods';
import { sumNutrients } from './nutrition';
export const nutrientKeys = ['calories', 'protein', 'fat', 'carbs'] as const;
export const sourceLabels = { official: '現在の公式値', official_old: '過去の公式値', secondary: '二次情報', estimate: '推定', unknown: '不明' };
export function searchRestaurants(stores: Restaurant[], query: string) {
  const tokens = query.trim().split(/\s+/).map(normalizeSearch);
  return stores.filter(store => tokens.every(t => normalizeSearch([store.name, ...store.aliases].join(' ')).includes(t)));
}
export function searchMenus(items: RestaurantMenuItem[], stores: Restaurant[], query: string) {
  const tokens = query.trim().split(/\s+/).map(normalizeSearch);
  return items.filter(item => {
    const store = stores.find(s => s.id === item.restaurantId);
    const text = normalizeSearch([store?.name, ...(store?.aliases ?? []), item.name, ...item.aliases, item.size, item.variantName].join(' '));
    return tokens.every(token => text.includes(token));
  });
}
export function menuGroups(items: RestaurantMenuItem[]) {
  const groups = new Map<string, RestaurantMenuItem[]>();
  items.forEach(item => groups.set(item.productGroupId, [...(groups.get(item.productGroupId) ?? []), item]));
  return [...groups.values()];
}
export function completeNutrients(item: RestaurantMenuItem): Nutrients {
  if (item.registrationBlockedReason) throw new Error(item.registrationBlockedReason);
  const { calories, protein, fat, carbs } = item;
  if (calories === null || protein === null || fat === null || carbs === null) throw new Error('PFC情報なし・栄養値が一部不明のため登録できません。');
  if ([calories, protein, fat, carbs].some(v => !Number.isFinite(v) || v < 0)) throw new Error('栄養値が正しくありません。');
  return { calories, protein, fat, carbs };
}
export function isComplete(item: RestaurantMenuItem) { return !item.registrationBlockedReason && nutrientKeys.every(key => item[key] !== null && Number.isFinite(item[key]) && item[key]! >= 0); }
export function validQuantity(quantity: number) { if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('数量は1〜99で指定してください。'); return quantity; }
export function changeCart(lines: RestaurantCartLine[], item: RestaurantMenuItem, quantity: number): RestaurantCartLine[] {
  if (quantity === 0) return lines.filter(line => line.item.id !== item.id);
  validQuantity(quantity); completeNutrients(item);
  return lines.some(line => line.item.id === item.id) ? lines.map(line => line.item.id === item.id ? { ...line, quantity } : line) : [...lines, { item, quantity }];
}
export function cartTotal(lines: RestaurantCartLine[]) { return sumNutrients(lines.map(line => scaleNutrients(completeNutrients(line.item), validQuantity(line.quantity)))); }
export function menuSourceType(item: RestaurantMenuItem): SourceType {
  const types = nutrientKeys.map(k => item.nutrientProvenance[k].sourceType);
  return types.includes('estimate') ? 'estimate' : types.includes('secondary') ? 'secondary' : types.includes('official_old') ? 'official_old' : 'official';
}
export function recentRestaurants(meals: MealEntry[], now = Date.now()) {
  const scores = new Map<string, { id: string; score: number; lastUsedAt: string; count: number }>();
  const seen = new Set<string>();
  for (const meal of [...meals].sort((a,b) => b.createdAt.localeCompare(a.createdAt))) {
    if (!meal.restaurantId) continue;
    const run = `${meal.restaurantId}:${meal.restaurantOrderId ?? meal.id}`;
    if (seen.has(run)) continue; seen.add(run);
    const previous = scores.get(meal.restaurantId) ?? { id: meal.restaurantId, score: 0, lastUsedAt: meal.createdAt, count: 0 };
    previous.score += 1 / (1 + Math.max(0, now - Date.parse(meal.createdAt)) / 604800000); previous.count++;
    scores.set(meal.restaurantId, previous);
  }
  return [...scores.values()].sort((a,b) => b.score - a.score || b.lastUsedAt.localeCompare(a.lastUsedAt));
}

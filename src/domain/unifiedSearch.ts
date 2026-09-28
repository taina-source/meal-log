import type { Favorite, Food, MealSet, Recipe, RecentItem } from './catalog';
import type { MealEntry } from './types';
import type { RestaurantIndex } from './restaurantIndex';
import { normalizeSearch } from './foods';
import { recentItems } from './recents';
import { savedMealHistory, savedMealKind } from './reuseMeals';
import { restaurants } from '../data/restaurants';
import { localDate, localTime } from './date';

export const searchCategories = ['favorites', 'history', 'recipes', 'sets', 'foods', 'restaurants'] as const;
export type SearchCategory = typeof searchCategories[number];
export const searchLabels: Record<SearchCategory, string> = { favorites: 'お気に入り', history: '履歴', recipes: 'レシピ', sets: 'セット', foods: '一般食品', restaurants: '外食' };
export type SearchReference = Pick<Favorite, 'kind' | 'sourceId' | 'quantity'> & { recent?: RecentItem; mealSnapshot?: MealEntry; savedEntries?: MealEntry[]; chainId?: string };
export interface SearchResult {
  key: string; category: SearchCategory; name: string; subtitle: string; terms: string[];
  reference?: SearchReference; favorite?: boolean; lastUsedAt?: string; count?: number;
}
export type PreparedResult = SearchResult & { normalized: string[]; searchText: string };
export function prepareResults(rows: SearchResult[]): PreparedResult[] {
  return rows.map(row => { const normalized = row.terms.map(normalizeSearch); return { ...row, normalized, searchText: normalized.join(' ') }; });
}
export function rankSearch(rows: PreparedResult[], query: string): PreparedResult[] {
  const tokens = query.trim().split(/\s+/).map(normalizeSearch).filter(Boolean), full = normalizeSearch(query);
  if (!tokens.length) return [];
  const tier = (row: PreparedResult) => row.normalized.includes(full) ? 0 : row.normalized.some(t => t.startsWith(full)) ? 1 : 2;
  return rows.filter(row => tokens.every(t => row.searchText.includes(t))).sort((a, b) => tier(a) - tier(b)
    || (a.category === 'history' && b.category === 'history' ? 0 : Number(!!b.favorite) - Number(!!a.favorite))
    || (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '') || (b.count ?? 0) - (a.count ?? 0) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
export function visibleResults(rows: SearchResult[], category: SearchCategory, all: boolean, limit = 20) {
  return rows.filter(r => r.category === category).slice(0, all ? 3 : limit);
}
export function menuSearchResults(index: RestaurantIndex): SearchResult[] {
  const chains = new Map(index.chains.map(c => [c.chainId, c]));
  return index.items.map(item => {
    const chain = chains.get(item.chainId)!;
    return { key: `restaurants:${item.itemId}`, category: 'restaurants', name: item.name,
      subtitle: [chain.chainName, item.variantName, item.size, item.servingBasis, item.calories === null ? 'kcal不明' : `${item.calories} kcal`, item.registrable ? '登録可' : '登録不可'].filter(Boolean).join(' · '),
      terms: [item.name, ...item.aliases, chain.chainName, ...chain.chainAliases, item.variantName, item.size, item.servingBasis ?? ''],
      reference: { kind: 'restaurantMenu', sourceId: item.itemId, chainId: item.chainId, quantity: 1 } };
  });
}
export interface SearchSources { foods: Food[]; meals: MealEntry[]; favorites: Favorite[]; recipes: Recipe[]; sets: MealSet[]; menus: SearchResult[] }
export function localSearchResults({ foods, meals, favorites, recipes, sets, menus }: SearchSources): SearchResult[] {
  const when = (stamp: string) => `${localDate(new Date(stamp))} ${localTime(new Date(stamp))}`;
  const rows: SearchResult[] = [];
  const histories: SearchResult[] = [];
  for (const kind of ['manualMeal', 'chatgptMeal'] as const) for (const group of savedMealHistory(meals, kind)) {
    histories.push({ key: `history:${kind}:${group.id}`, category: 'history', name: group.entries.map(m => m.name).join(' / '),
      subtitle: `${when(group.entries[0].eatenAt)} · ${kind === 'manualMeal' ? '手動' : 'ChatGPT'} · ${group.entries.length}品`,
      terms: group.entries.flatMap(m => [m.name, m.restaurant ?? '']), lastUsedAt: group.entries[0].createdAt,
      reference: { kind, sourceId: group.id, quantity: 1, savedEntries: group.entries } });
  }
  const groups = new Map<string, MealEntry[]>();
  for (const meal of meals) if (!savedMealKind(meal)) {
    const key = meal.setRunId ? `set:${meal.setRunId}` : `meal:${meal.id}`;
    const group = groups.get(key) ?? []; group.push(meal); groups.set(key, group);
  }
  for (const [key, group] of groups) {
    const meal = [...group].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))[0];
    const recent = recentItems(group, Date.parse(meal.createdAt))[0];
    const reference: SearchReference | undefined = recent ? { ...recent, recent }
      : meal.restaurantId && meal.sourceId ? { kind: 'restaurantMenu', chainId: meal.restaurantId, sourceId: meal.sourceId, quantity: meal.quantity ?? 1 } : undefined;
    histories.push({ key: `history:${key}`, category: 'history', name: meal.setName ?? meal.name,
      subtitle: `${when(meal.eatenAt)} · ${meal.restaurant || (recent?.kind === 'food' ? '食品' : recent?.kind === 'recipe' ? 'レシピ' : recent?.kind === 'set' ? 'セット' : meal.sourceType)} · ${meal.quantity ?? 1}${meal.unit ?? ''}${reference ? '' : ' · 既存の再登録に未対応'}`,
      terms: group.flatMap(m => [m.name, m.restaurant ?? '', m.setName ?? '']), lastUsedAt: meal.createdAt, reference });
  }
  const usage = new Map<string, { lastUsedAt: string; count: number }>();
  for (const row of histories) if (row.reference) {
    const key = `${row.reference.kind}:${row.reference.sourceId}`, old = usage.get(key);
    usage.set(key, { lastUsedAt: !old || old.lastUsedAt < (row.lastUsedAt ?? '') ? row.lastUsedAt ?? '' : old.lastUsedAt, count: (old?.count ?? 0) + 1 });
  }
  rows.push(...histories);
  rows.push(...foods.map(food => ({ key: `foods:${food.id}`, category: 'foods' as const, name: food.name, subtitle: `${food.category} · 可食部100gあたり ${food.raw.calories || '不明'} kcal`, terms: [food.name, ...food.aliases], reference: { kind: 'food' as const, sourceId: food.id, quantity: 100 } })));
  rows.push(...recipes.map(recipe => ({ key: `recipes:${recipe.id}`, category: 'recipes' as const, name: recipe.name, subtitle: `${recipe.servings}食分のレシピ`, terms: [recipe.name], reference: { kind: 'recipe' as const, sourceId: recipe.id, quantity: 1 / recipe.servings } })));
  rows.push(...sets.map(set => ({ key: `sets:${set.id}`, category: 'sets' as const, name: set.name, subtitle: `${set.items.length}品 · ${set.total.calories} kcal`, terms: [set.name], reference: { kind: 'set' as const, sourceId: set.id, quantity: 1 } })));
  const targets = new Map([...rows.filter(r => r.category !== 'history'), ...menus].filter(r => r.reference).map(r => [`${r.reference!.kind}:${r.reference!.sourceId}`, r]));
  const favoriteKeys = new Set(favorites.map(f => `${f.kind}:${f.sourceId}`));
  for (const f of favorites) {
    const target = targets.get(`${f.kind}:${f.sourceId}`), store = f.kind === 'restaurant' ? restaurants.find(r => r.id === f.sourceId) : undefined;
    const name = f.mealSnapshot?.name ?? target?.name ?? store?.name ?? '元データが見つかりません';
    rows.push({ key: `favorites:${f.id}`, category: 'favorites', name, favorite: true,
      subtitle: target?.subtitle ?? (f.mealSnapshot ? `${f.mealSnapshot.calories} kcal · 前回の保存値` : store ? '店舗' : 'データの読み込み・参照先を確認してください'),
      terms: [name, ...(target?.terms ?? []), ...(store?.aliases ?? []), f.mealSnapshot?.restaurant ?? ''],
      reference: f.mealSnapshot || target || store ? { ...f, chainId: target?.reference?.chainId ?? store?.id } : undefined });
  }
  return rows.map(row => {
    const key = row.reference ? `${row.reference.kind}:${row.reference.sourceId}` : '';
    return { ...row, ...(row.category !== 'history' ? usage.get(key) : {}), favorite: row.favorite || favoriteKeys.has(key) };
  });
}

import { describe, expect, it } from 'vitest';
import { localSearchResults, prepareResults, rankSearch, visibleResults, menuSearchResults, type SearchResult } from './unifiedSearch';
import type { MealEntry } from './types';
import type { FoodDataset, Recipe, MealSet } from './catalog';
import catalog from '../../public/data/mext-foods.json';
import { portionGrams } from './foodUnits';
import { localDate, localTime } from './date';
const meal = (id: string, name = 'ご飯'): MealEntry => ({ id, name, restaurant: '', sourceType: 'manual', mealType: 'lunch', eatenAt: '2026-09-01T03:00:00.000Z', createdAt: '2026-09-01T03:00:00.000Z', updatedAt: '2026-09-01T03:00:00.000Z', calories: 200, protein: 2, fat: 1, carbs: 40, confidence: null });
const row = (key: string, name: string, extra: Partial<SearchResult> = {}): SearchResult => ({ key, name, category: 'foods', terms: [name], subtitle: '', ...extra });
const foods = (catalog as FoodDataset).foods;
const base = { foods: [], meals: [], favorites: [], recipes: [], sets: [], menus: [] };
describe('unified search', () => {
  it.each([['KFC', 'kfc'], ['ＫＦＣ', 'kfc'], ['ｺﾞﾊﾝ', 'ごはん'], ['ゴハン', 'ごはん'], [' ご飯 ', 'ご飯'], ['卵　ご飯', 'ご飯と卵'], ['ご飯 卵', '卵とご飯']])('normalizes %s', (query, name) => expect(rankSearch(prepareResults([row('a', name)]), query)).toHaveLength(1));
  it('requires all words', () => expect(rankSearch(prepareResults([row('a', 'ご飯')]), '卵 ご飯')).toHaveLength(0));
  it('ranks exact, prefix, partial before familiarity', () => {
    const rows = [row('partial', '朝の卵', { favorite: true, count: 99 }), row('prefix', '卵料理'), row('exact', '卵')];
    expect(rankSearch(prepareResults(rows), '卵').map(r => r.key)).toEqual(['exact', 'prefix', 'partial']);
  });
  it('same tier uses favorite, recency, count and stable key', () => {
    const rows = [row('z', '卵'), row('a', '卵'), row('count', '卵', { count: 2 }), row('recent', '卵', { lastUsedAt: '2026-09-28' }), row('fav', '卵', { favorite: true })];
    expect(rankSearch(prepareResults(rows.reverse()), '卵').map(r => r.key)).toEqual(['fav', 'recent', 'count', 'a', 'z']);
  });
  it('history prioritizes newest over favorites at same tier', () => expect(rankSearch(prepareResults([row('old', '卵', { category: 'history', favorite: true }), row('new', '卵', { category: 'history', lastUsedAt: '2026-09-28' })]), '卵')[0].key).toBe('new'));
  it('empty query returns no mass results', () => expect(rankSearch(prepareResults([row('a', '卵')]), '  ')).toEqual([]));
  it('preserves same-name different categories and keys', () => {
    const food = foods.find(f => f.id === 'mext-01088')!;
    const recipe: Recipe = { id: 'same', name: food.name, servings: 2, ingredients: [], createdAt: '', updatedAt: '' };
    const set: MealSet = { id: 'same', name: food.name, items: [], total: meal('n'), createdAt: '', updatedAt: '' };
    const menus = [row('restaurants:same', food.name, { category: 'restaurants' })];
    const rows = [...localSearchResults({ ...base, foods: [food], meals: [meal('same', food.name)], recipes: [recipe], sets: [set], menus, favorites: [{ id: 'same', kind: 'food', sourceId: food.id, quantity: 170, createdAt: '' }] }), ...menus];
    expect(new Set(rows.map(r => r.key)).size).toBe(6);
    expect(rankSearch(prepareResults(rows), food.name)).toHaveLength(6);
    expect(rows.find(r => r.category === 'recipes')?.reference?.quantity).toBe(0.5);
    expect(rows.find(r => r.category === 'favorites')?.reference?.quantity).toBe(170);
  });
  it.each([[true, 20, 3], [false, 20, 20], [false, 40, 40]])('limits and more: %s %s', (all, limit, count) => expect(visibleResults(Array.from({ length: 50 }, (_, i) => row(String(i), '卵')), 'foods', all, limit)).toHaveLength(count));
  it('searches older than 30 records without recentItems truncation', () => {
    const rows = localSearchResults({ ...base, meals: Array.from({ length: 80 }, (_, i) => ({ ...meal(String(i), `食事${i}`), sourceType: 'database', sourceId: `food${i}`, quantity: 125, unit: 'g' })) });
    expect(rows).toHaveLength(80);
    expect(rankSearch(prepareResults(rows), '食事79')[0].reference?.quantity).toBe(125);
  });
  it('ChatGPT group matches member, preserves complete saved entries', () => {
    const entries = [meal('a', '卵'), meal('b', 'ご飯')].map(m => ({ ...m, sourceType: 'chatgpt' as const, chatgptImportId: 'group' }));
    const rows = rankSearch(prepareResults(localSearchResults({ ...base, meals: entries })), '卵');
    expect(rows).toHaveLength(1); expect(rows[0].reference?.savedEntries).toHaveLength(2);
    expect(rows[0].reference?.savedEntries?.[0].calories).toBe(200);
  });
  it('recipe and set histories retain saved definitions', () => {
    const recipe: Recipe = { id: 'r', name: '昔のレシピ', ingredients: [], servings: 2, createdAt: '', updatedAt: '' };
    const entries = [{ ...meal('r'), sourceType: 'recipe' as const, sourceId: 'r', recipeSnapshot: recipe, quantity: 0.5, unit: 'whole' as const }, { ...meal('s'), sourceType: 'database' as const, sourceId: 'f', setId: 'set', setRunId: 'run', setName: '昔のセット', quantity: 100, unit: 'g' as const }];
    const rows = localSearchResults({ ...base, meals: entries });
    expect(rows.find(r => r.reference?.kind === 'recipe')?.reference?.recent?.item?.recipeSnapshot).toEqual(recipe);
    expect(rows.find(r => r.reference?.kind === 'set')?.reference?.recent?.setSnapshot?.items[0].nutrients.calories).toBe(200);
  });
  it('manual favorite passes snapshot untouched', () => {
    const snapshot = meal('old');
    const rows = localSearchResults({ ...base, favorites: [{ id: 'f', kind: 'manualMeal', sourceId: 'old', quantity: 1, createdAt: '', mealSnapshot: snapshot }] });
    expect(rows[0].reference?.mealSnapshot).toBe(snapshot);
  });
  it('unresolved favorite is not routed to the full restaurant loader', () => {
    const rows = localSearchResults({ ...base, favorites: [{ id: 'f', kind: 'restaurantMenu', sourceId: 'missing', quantity: 1, createdAt: '' }] });
    expect(rows[0].reference).toBeUndefined();
  });
  it('history date and time use the existing local helpers', () => {
    const m = { ...meal('a'), eatenAt: '2026-09-01T23:30:00.000Z' };
    const rows = localSearchResults({ ...base, meals: [m] });
    expect(rows[0].subtitle).toContain(`${localDate(new Date(m.eatenAt))} ${localTime(new Date(m.eatenAt))}`);
  });
  it('food selection leaves units and nutrition to existing picker helpers', () => {
    const food = foods.find(f => f.id === 'mext-01088')!;
    const result = localSearchResults({ ...base, foods: [food] })[0];
    expect(result.reference).toEqual({ kind: 'food', sourceId: food.id, quantity: 100 });
    expect(portionGrams(food.id, 'cooked-go', 0.5, 340)).toBe(170);
    expect(food).toEqual(foods.find(f => f.id === 'mext-01088'));
  });
  it('restaurant names, null kcal and blocked items remain searchable', () => {
    const rows = menuSearchResults({ formatVersion: 1, chains: [{ chainId: 'c', chainName: 'KFC', chainAliases: ['ケンタ'], file: '', sha256: '', count: 1 }], items: [{ chainId: 'c', itemId: 'i', productGroupId: 'g', name: '商品', aliases: [], variantName: '大', size: '', category: '', registrable: false, calories: null }] });
    expect(rankSearch(prepareResults(rows), 'ｹﾝﾀ')[0].subtitle).toContain('kcal不明 · 登録不可');
    expect(rows[0].reference).toEqual({ kind: 'restaurantMenu', sourceId: 'i', chainId: 'c', quantity: 1 });
  });
});

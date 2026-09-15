import { useRestaurantMenus } from '../../data/restaurantMenus';
import { restaurants } from '../../data/restaurants';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Favorite, FavoriteKind, Food, RecentItem } from '../../domain/catalog';
import { db } from '../../data/db';
import { recentItems } from '../../domain/recents';
import { removeFavorite } from '../../data/catalogRepository';
import { ActionButton, NutrientSummary } from '../../components/CatalogParts';
import { formatNumber, sumNutrients } from '../../domain/nutrition';
import type { MealEntry } from '../../domain/types';
import { savedMealHistory } from '../../domain/reuseMeals';
import { SavedMealFavorite } from '../../components/SavedMealFavorite';
export type CatalogReference = Pick<Favorite, 'kind' | 'sourceId' | 'quantity'> & { recent?: RecentItem; mealSnapshot?: MealEntry; savedEntries?: MealEntry[] };
export function Favorites({ foods, onSelect }: { foods: Food[]; onSelect: (reference: CatalogReference) => void }) {
  const [kind, setKind] = useState<FavoriteKind>('food'), [mode, setMode] = useState<'favorites' | 'recent'>('favorites');
  const { items: menus = [] } = useRestaurantMenus();
  const favorites = useLiveQuery(() => db.favorites.toArray(), []) ?? [];
  const recipes = useLiveQuery(() => db.recipes.toArray(), []) ?? [];
  const sets = useLiveQuery(() => db.mealSets.toArray(), []) ?? [];
  const meals = useLiveQuery(() => db.meals.toArray(), []) ?? [];
  const recent = recentItems(meals);
  const [visible, setVisible] = useState(20);
  function name(reference: CatalogReference) { return reference.mealSnapshot?.name ?? (reference.kind === 'restaurant' ? restaurants : reference.kind === 'restaurantMenu' ? menus.map(m => ({ ...m, name: m.name + ' ' + m.variantName })) : reference.kind === 'food' ? foods : reference.kind === 'recipe' ? recipes : sets).find(item => item.id === reference.sourceId)?.name ?? '元データが見つかりません'; }
  const items = favorites.filter(item => item.kind === kind);
  return <div className="form-stack"><h3>お気に入り・履歴</h3><div className="segmented"><button aria-pressed={mode === 'favorites'} className={mode === 'favorites' ? 'selected' : ''} onClick={() => setMode('favorites')}>お気に入り</button><button aria-pressed={mode === 'recent'} className={mode === 'recent' ? 'selected' : ''} onClick={() => setMode('recent')}>最近の履歴</button></div><div className="choice-grid favorite-categories">{(['food', 'recipe', 'set', 'restaurant', 'restaurantMenu', 'chatgptMeal', 'manualMeal'] as const).map((value, index) => <button key={value} aria-pressed={kind === value} className={kind === value ? 'selected' : ''} onClick={() => { setKind(value); setVisible(20); }}>{['食品', 'レシピ', 'セット', '店舗', '外食商品', 'ChatGPT', '手動入力'][index]}</button>)}</div>{mode === 'favorites' ? <>{items.map(item => <div className="favorite-row" key={item.id}><button className="catalog-row" onClick={() => onSelect(item)}><strong>★ {name(item)}</strong><span>{quantityLabel(item)}</span>{item.mealSnapshot && <NutrientSummary value={item.mealSnapshot} />}</button><ActionButton className="button danger-subtle small" action={() => removeFavorite(item.id)}>解除</ActionButton></div>)}{!items.length && <p className="help">まだお気に入りがありません。各料理の画面や最近の履歴で☆を押すと追加できます。</p>}</> : kind === 'chatgptMeal' || kind === 'manualMeal' ? <><div className="catalog-list">{savedMealHistory(meals, kind).slice(0, visible).map(group => <section className="card settings-card form-stack" key={group.id}><h3>{kind === 'chatgptMeal' ? 'ChatGPT取り込み' : '手動入力'} · {group.entries.length}品</h3><p className="help">{new Date(group.entries[0].eatenAt).toLocaleString('ja-JP')}</p>{group.entries.map(meal => <div className="form-stack" key={meal.id}><strong>{meal.name}</strong><SavedMealFavorite meal={meal} /></div>)}<NutrientSummary value={sumNutrients(group.entries)} label="保存値の合計" /><button className="button primary" onClick={() => onSelect({ kind, sourceId: group.id, quantity: 1, savedEntries: group.entries })}>確認して再利用</button></section>)}</div>{!savedMealHistory(meals, kind).length && <p className="help">この種類の履歴はまだありません。</p>}{savedMealHistory(meals, kind).length > visible && <button className="button secondary" onClick={() => setVisible(n => n + 20)}>さらに表示</button>}</> : <RecentList items={recent.filter(item => item.kind === kind)} onSelect={onSelect} />}</div>;
}
export function quantityLabel(reference: Pick<Favorite, 'kind' | 'quantity'>) { return reference.kind === 'chatgptMeal' || reference.kind === 'manualMeal' ? '1料理（前回の最終保存値）' : reference.kind === 'food' ? `${formatNumber(reference.quantity, true)}g` : reference.kind === 'recipe' ? `レシピ全体の${formatNumber(reference.quantity * 100, true)}%` : reference.kind === 'restaurant' ? '店舗' : reference.kind === 'restaurantMenu' ? reference.quantity + '点' : '1セット'; }
export function RecentList({ items, onSelect }: { items: RecentItem[]; onSelect: (reference: CatalogReference) => void }) {
  return <div className="catalog-list">{items.map(item => <button key={`${item.kind}:${item.sourceId}`} className="catalog-row" onClick={() => onSelect({ ...item, recent: item })}><strong>{item.name}</strong><span>{quantityLabel(item)} · {item.count}回使用</span></button>)}{!items.length && <p className="help">食品・レシピ・セットを登録すると、ここから前回の量ですぐに選べます。</p>}</div>;
}

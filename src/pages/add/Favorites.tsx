import { useRestaurantMenus } from '../../data/restaurantMenus';
import { restaurants } from '../../data/restaurants';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Favorite, FavoriteKind, Food, RecentItem } from '../../domain/catalog';
import { db } from '../../data/db';
import { recentItems } from '../../domain/recents';
import { removeFavorite } from '../../data/catalogRepository';
import { ActionButton } from '../../components/CatalogParts';
import { formatNumber } from '../../domain/nutrition';
export type CatalogReference = Pick<Favorite, 'kind' | 'sourceId' | 'quantity'> & { recent?: RecentItem };
export function Favorites({ foods, onSelect }: { foods: Food[]; onSelect: (reference: CatalogReference) => void }) {
  const [kind, setKind] = useState<FavoriteKind>('food'), [mode, setMode] = useState<'favorites' | 'recent'>('favorites');
  const { items: menus = [] } = useRestaurantMenus();
  const favorites = useLiveQuery(() => db.favorites.toArray(), []) ?? [];
  const recipes = useLiveQuery(() => db.recipes.toArray(), []) ?? [];
  const sets = useLiveQuery(() => db.mealSets.toArray(), []) ?? [];
  const recent = useLiveQuery(async () => recentItems(await db.meals.toArray()), []) ?? [];
  function name(reference: CatalogReference) { return (reference.kind === 'restaurant' ? restaurants : reference.kind === 'restaurantMenu' ? menus.map(m => ({ ...m, name: m.name + ' ' + m.variantName })) : reference.kind === 'food' ? foods : reference.kind === 'recipe' ? recipes : sets).find(item => item.id === reference.sourceId)?.name ?? '元データが見つかりません'; }
  const items = favorites.filter(item => item.kind === kind);
  return <div className="form-stack"><h3>お気に入り・履歴</h3><div className="segmented"><button aria-pressed={mode === 'favorites'} className={mode === 'favorites' ? 'selected' : ''} onClick={() => setMode('favorites')}>お気に入り</button><button aria-pressed={mode === 'recent'} className={mode === 'recent' ? 'selected' : ''} onClick={() => setMode('recent')}>最近の履歴</button></div><div className="choice-grid">{(['food', 'recipe', 'set', 'restaurant', 'restaurantMenu'] as const).map((value, index) => <button key={value} aria-pressed={kind === value} className={kind === value ? 'selected' : ''} onClick={() => setKind(value)}>{['食品', 'レシピ', 'セット', '店舗', '外食商品'][index]}</button>)}</div>{mode === 'favorites' ? <>{items.map(item => <div className="favorite-row" key={item.id}><button className="catalog-row" onClick={() => onSelect(item)}><strong>★ {name(item)}</strong><span>{quantityLabel(item)}</span></button><ActionButton className="button danger-subtle small" action={() => removeFavorite(item.id)}>解除</ActionButton></div>)}{!items.length && <p className="help">まだお気に入りがありません。食品・レシピ・セットの画面で☆を押すと追加できます。</p>}</> : <RecentList items={recent.filter(item => item.kind === kind)} onSelect={onSelect} />}</div>;
}
export function quantityLabel(reference: Pick<Favorite, 'kind' | 'quantity'>) { return reference.kind === 'food' ? `${formatNumber(reference.quantity, true)}g` : reference.kind === 'recipe' ? `レシピ全体の${formatNumber(reference.quantity * 100, true)}%` : reference.kind === 'restaurant' ? '店舗' : reference.kind === 'restaurantMenu' ? reference.quantity + '点' : '1セット'; }
export function RecentList({ items, onSelect }: { items: RecentItem[]; onSelect: (reference: CatalogReference) => void }) {
  return <div className="catalog-list">{items.map(item => <button key={`${item.kind}:${item.sourceId}`} className="catalog-row" onClick={() => onSelect({ ...item, recent: item })}><strong>{item.name}</strong><span>{quantityLabel(item)} · {item.count}回使用</span></button>)}{!items.length && <p className="help">食品・レシピ・セットを登録すると、ここから前回の量ですぐに選べます。</p>}</div>;
}

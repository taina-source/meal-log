import { useSheetTop } from '../../components/CatalogParts';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Food, MealSetItem, Recipe } from '../../domain/catalog';
import { db } from '../../data/db';
import { createId } from '../../data/id';
import { normalizeSearch, recipeItem, recipePortion, recipeTotal } from '../../domain/foods';
import { recentItems } from '../../domain/recents';
import { formatNumber } from '../../domain/nutrition';
import { ActionButton, BackButton, FavoriteButton, NutrientSummary, Notes } from '../../components/CatalogParts';
import { RecipeEditor } from './RecipeEditor';
export function RecipeLibrary({ foods, onChoose, initialRecipe, initialFraction, actionLabel = 'この量で食事に登録' }: { foods: Food[]; onChoose: (item: MealSetItem) => unknown | Promise<unknown>; initialRecipe?: Recipe; initialFraction?: number; actionLabel?: string }) {
  const [selected, setSelected] = useState(initialRecipe), [mode, setMode] = useState<'detail' | 'new' | 'edit' | 'duplicate' | 'once'>('detail');
  const [query, setQuery] = useState(''), [fraction, setFraction] = useState(initialFraction);
  const recipes = useLiveQuery(() => db.recipes.orderBy('updatedAt').reverse().toArray(), []) ?? [];
  const favorites = useLiveQuery(() => db.favorites.where('kind').equals('recipe').toArray(), []) ?? [];
  const recent = useLiveQuery(async () => recentItems(await db.meals.toArray()).filter(item => item.kind === 'recipe'), []) ?? [];
  useSheetTop(mode + (selected?.id ?? 'list'));
  const matching = recipes.filter(recipe => normalizeSearch(recipe.name).includes(normalizeSearch(query)));
  if (mode !== 'detail') return <RecipeEditor foods={foods} original={selected} mode={mode} onCancel={() => setMode('detail')} onDone={recipe => { setSelected(recipe); setMode('detail'); setFraction(undefined); }} />;
  if (selected) return <div className="form-stack"><BackButton label="レシピ一覧へ" onClick={() => { setSelected(undefined); setFraction(undefined); }} /><h3 className="wrapping-name">{selected.name}</h3><NutrientSummary label="レシピ全体" value={recipeTotal(selected)} /><NutrientSummary label={`1食あたり（全体を${selected.servings}食分に分割）`} value={recipePortion(selected)} /><details className="catalog-details"><summary>材料を見る（{selected.ingredients.length}個）</summary>{selected.ingredients.map(item => <p key={item.id}>{item.name} · {item.grams}g</p>)}</details><h3>今回食べた量</h3><div className="choice-grid recipe-choices">{([['1食分', undefined], ['全体の1/2', .5], ['全体の1/3', 1 / 3], ['全体の1/4', .25]] as const).map(([label, value]) => <button key={label} aria-pressed={fraction === value} onClick={() => setFraction(value)}>{label}</button>)}</div><NutrientSummary value={recipePortion(selected, fraction ?? 1 / selected.servings)} /><Notes notes={[...new Set(selected.ingredients.flatMap(item => item.notes))]} /><FavoriteButton kind="recipe" sourceId={selected.id} quantity={fraction ?? 1 / selected.servings} /><ActionButton action={() => onChoose(recipeItem(selected, fraction ?? 1 / selected.servings, createId()))}>{actionLabel}</ActionButton><button className="button secondary" onClick={() => setMode('once')}>今回だけ材料を変更</button><div className="two-columns"><button className="button secondary" onClick={() => setMode('edit')}>レシピを編集</button><button className="button secondary" onClick={() => setMode('duplicate')}>複製して作る</button></div></div>;
  const section = (title: string, items: Recipe[]) => <section className="form-stack"><h3>{title}</h3>{items.length ? <div className="catalog-list">{items.map(recipe => <button className="catalog-row" key={recipe.id} onClick={() => { setSelected(recipe); setFraction(undefined); }}><strong>{recipe.name}</strong><span>{formatNumber(recipePortion(recipe).calories)} kcal / 1食分</span></button>)}</div> : <p className="help">まだありません</p>}</section>;
  return <div className="form-stack"><h3>レシピ</h3><label className="field"><span className="sr-only">レシピを検索</span><input type="search" placeholder="レシピを検索" value={query} onChange={event => setQuery(event.target.value)} /></label><button className="button primary" onClick={() => { setSelected(undefined); setMode('new'); }}>＋ 新しいレシピを作る</button>{section('最近使ったレシピ', recent.flatMap(item => matching.filter(recipe => recipe.id === item.sourceId)).slice(0, 5))}{section('お気に入りレシピ', matching.filter(recipe => favorites.some(favorite => favorite.sourceId === recipe.id)))}{section('全レシピ', matching)}</div>;
}

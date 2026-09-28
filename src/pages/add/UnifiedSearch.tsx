import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { restaurantSearchLoader } from '../../data/restaurantSearch';
import type { Food, MealSet, Recipe } from '../../domain/catalog';
import { localSearchResults, menuSearchResults, prepareResults, rankSearch, searchCategories, searchLabels, visibleResults, type SearchCategory, type SearchReference, type SearchResult } from '../../domain/unifiedSearch';
import { FormError } from '../../components/Fields';
import { quantityLabel } from './Favorites';

const empty: never[] = [];
export function UnifiedSearch({ foods, recipes, sets, query, onQuery, category, onCategory, onSelect, children }: {
  foods: Food[]; recipes: Recipe[]; sets: MealSet[]; query: string; onQuery: (q: string) => void;
  category: SearchCategory | 'all'; onCategory: (c: SearchCategory | 'all') => void;
  onSelect: (reference: SearchReference) => void; children: ReactNode;
}) {
  const meals = useLiveQuery(() => db.meals.toArray(), []) ?? empty;
  const favorites = useLiveQuery(() => db.favorites.toArray(), []) ?? empty;
  const [menus, setMenus] = useState<SearchResult[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(false), [limit, setLimit] = useState(20);
  const needsIndex = (!!query.trim() && (category === 'all' || category === 'restaurants' || category === 'favorites')) || favorites.some(f => f.kind === 'restaurantMenu');
  useEffect(() => {
    if (!needsIndex) return;
    let active = true;
    setLoading(true); setError('');
    restaurantSearchLoader.loadIndex().then(index => { if (active) setMenus(menuSearchResults(index)); }).catch(() => { if (active) setError('外食検索データを読み込めません。オンラインでアプリの更新を完了してください。'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [needsIndex]);
  const locals = useMemo(() => localSearchResults({ foods, meals, favorites, recipes, sets, menus }), [foods, meals, favorites, recipes, sets, menus]);
  const prepared = useMemo(() => {
    const favs = new Set(favorites.filter(f => f.kind === 'restaurantMenu').map(f => f.sourceId));
    const usage = new Map<string, { lastUsedAt: string; count: number }>();
    for (const m of meals) if (m.restaurantId && m.sourceId) { const old = usage.get(m.sourceId); usage.set(m.sourceId, { lastUsedAt: old && old.lastUsedAt > m.createdAt ? old.lastUsedAt : m.createdAt, count: (old?.count ?? 0) + 1 }); }
    return prepareResults([...locals, ...menus.map(row => ({ ...row, favorite: favs.has(row.reference!.sourceId), ...usage.get(row.reference!.sourceId) }))]);
  }, [locals, menus, favorites, meals]);
  const results = useMemo(() => rankSearch(prepared, query), [prepared, query]);
  function rows(list: SearchResult[]) {
    return <div className="catalog-list">{list.map(row => <button className="catalog-row" key={row.key} disabled={!row.reference} onClick={() => row.reference && onSelect(row.reference)}><strong>{row.name}</strong>{row.category === 'favorites' && row.reference && <span>{quantityLabel(row.reference)}</span>}<span>{row.subtitle}</span></button>)}</div>;
  }
  return <section className="form-stack" aria-label="統合検索">
    <label className="field"><span className="sr-only">食品・料理・店名を検索</span><input type="search" placeholder="食品・料理・店名を検索" value={query} onChange={e => { onQuery(e.target.value); setLimit(20); }} /></label>
    <div className="choice-grid" role="group" aria-label="検索カテゴリ">{(['all', 'foods', 'restaurants', 'history', 'favorites', 'recipes', 'sets'] as const).map(c => <button key={c} aria-pressed={category === c} onClick={() => { onCategory(c); setLimit(20); }}>{c === 'all' ? 'すべて' : c === 'foods' ? '食品' : searchLabels[c]}</button>)}</div>
    <FormError message={error} />{loading && <p role="status">外食検索データを読み込み中…</p>}
    {query.trim() ? (category === 'all' ? searchCategories : [category]).map(c => <section key={c} className="form-stack" aria-label={`${searchLabels[c]}の検索結果`}><h3>{searchLabels[c]} <small>{results.filter(r => r.category === c).length}件</small></h3>{rows(visibleResults(results, c, category === 'all', limit))}{!results.some(r => r.category === c) && <p className="help">該当する結果はありません。</p>}{results.filter(r => r.category === c).length > (category === 'all' ? 3 : limit) && <button className="button secondary" aria-label={`${searchLabels[c]}をもっと見る`} onClick={() => { if (category === 'all') { onCategory(c); setLimit(20); } else setLimit(n => n + 20); }}>もっと見る</button>}</section>)
      : <>{children}<section className="form-stack" aria-label="お気に入りの候補"><h3>お気に入り</h3>{rows(locals.filter(r => r.category === 'favorites').sort((a, b) => a.key.localeCompare(b.key)).slice(0, 4))}{!favorites.length && <p className="help">お気に入りはまだありません。</p>}</section></>}
  </section>;
}

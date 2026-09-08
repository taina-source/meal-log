import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Restaurant, RestaurantCartLine, RestaurantMenuItem } from '../../domain/catalog';
import type { MealContext } from '../../data/catalogRepository';
import { restaurants } from '../../data/restaurants';
import { db } from '../../data/db';
import { useRestaurantMenus } from '../../data/restaurantMenus';
import { cartTotal, changeCart, isComplete, menuGroups, recentRestaurants, searchMenus, searchRestaurants, sourceLabels } from '../../domain/restaurantMenus';
import { ActionButton, BackButton, useSheetTop } from '../../components/CatalogParts';
import { favoriteId, removeFavorite, saveFavorite } from '../../data/catalogRepository';
import { FormError } from '../../components/Fields';
import { MenuNutrition } from '../../components/RestaurantParts';
import { formatNumber } from '../../domain/nutrition';
import { RestaurantDetail } from './RestaurantDetail';
import { RestaurantCart } from './RestaurantCart';

export function Restaurants({ context, onSaved, initialId }: { context: MealContext; onSaved: (date: string) => void; initialId?: string }) {
  const { items, error } = useRestaurantMenus();
  const [query, setQuery] = useState(''), [storeQuery, setStoreQuery] = useState(''), [category, setCategory] = useState(''), [menuCategory, setMenuCategory] = useState('');
  const [selected, setSelected] = useState<Restaurant | undefined>(() => restaurants.find(s => s.id === initialId));
  const [detailId, setDetailId] = useState<string | undefined>(initialId?.startsWith('restaurant:') ? undefined : initialId);
  const [cart, setCart] = useState<RestaurantCartLine[]>([]), [review, setReview] = useState(false), [notice, setNotice] = useState('');
  const [limit, setLimit] = useState(35);
  const meals = useLiveQuery(() => db.meals.toArray(), []) ?? [];
  const favorites = useLiveQuery(() => db.favorites.toArray(), []) ?? [];
  useSheetTop(review ? 'cart' : detailId ?? selected?.id ?? 'restaurants');
  if (error) return <FormError message={error} />;
  if (!items) return <p className="help">外食データを読み込み中…</p>;
  const detail = items.find(item => item.id === detailId);
  const openStore = (store: Restaurant) => { setSelected(store); setStoreQuery(''); setMenuCategory(''); setLimit(35); setNotice(''); };
  const openDetail = (item: RestaurantMenuItem) => { setDetailId(item.id); setNotice(''); };
  const add = (item: RestaurantMenuItem) => {
    const quantity = cart.find(line => line.item.id === item.id)?.quantity ?? 0;
    if (quantity >= 99) { setNotice('数量は99までです。'); return; }
    setCart(changeCart(cart, item, quantity + 1)); setNotice(item.name + 'を追加しました');
  };
  const storeRows = (stores: Restaurant[]) => <div className="catalog-list">{stores.map(store => <button key={store.id} className="catalog-row" onClick={() => openStore(store)}><strong>{store.name}</strong><span>{store.category} · {items.some(item => item.restaurantId === store.id) ? 'メニューを見る' : 'メニューデータは今後追加予定'}</span></button>)}{!stores.length && <p className="help">まだありません</p>}</div>;
  const menuRows = (list: RestaurantMenuItem[], grouped = true) => {
    const groups = grouped ? menuGroups(list) : list.map(item => [item]);
    return <div className="catalog-list">{groups.slice(0, limit).map(variants => {
      const item = variants[0], store = restaurants.find(s => s.id === item.restaurantId);
      const types = [...new Set(Object.values(item.nutrientProvenance).map(p => sourceLabels[p.sourceType]))];
      return <div className="menu-row" key={item.id}><button className="catalog-row" onClick={() => openDetail(item)}><span>{store?.name} · {item.category}</span><strong>{item.name}</strong><span>{variants.length > 1 ? `サイズ・地域 ${variants.length}種類（表示：${item.variantName || '標準'}）` : item.variantName}</span><MenuNutrition item={item} /><span>{types.join(' / ')}{item.isLimitedTime ? ' · 期間限定' : ''}</span></button><button className="menu-add" aria-label={`${item.name}${variants.length > 1 ? 'のサイズを選択' : 'を追加'}`} disabled={variants.length === 1 && !isComplete(item)} onClick={() => variants.length > 1 ? openDetail(item) : add(item)}>＋</button></div>;
    })}{groups.length > limit && <button className="button secondary" onClick={() => setLimit(limit + 35)}>さらに表示（残り{groups.length - limit}件）</button>}{!groups.length && <p className="help">該当する商品がありません。</p>}</div>;
  };
  const favoriteMenus = items.filter(item => favorites.some(f => f.kind === 'restaurantMenu' && f.sourceId === item.id) && (!selected || item.restaurantId === selected.id));
  const storeItems = selected ? items.filter(item => item.restaurantId === selected.id) : [];
  const recentMenuIds = [...new Set(meals.filter(meal => meal.restaurantId === selected?.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(meal => meal.sourceId))].slice(0,5);
  const storeFavorite = selected ? favorites.find(f => f.id === favoriteId('restaurant', selected.id, 1)) : undefined;
  return <div className="form-stack restaurant-flow">
    {review ? <RestaurantCart lines={cart} context={context} onChange={(line, quantity) => setCart(changeCart(cart, line.item, quantity))} onBack={() => setReview(false)} onSaved={onSaved} />
    : detail ? <RestaurantDetail key={detail.id} initial={detail} variants={items.filter(item => item.productGroupId === detail.productGroupId)} onBack={() => setDetailId(undefined)} onAdd={add} />
    : selected ? <><BackButton label="外食一覧へ" onClick={() => { setSelected(undefined); setLimit(35); }} /><div className="store-heading"><h3>{selected.name}</h3><ActionButton className="button secondary small" action={() => storeFavorite ? removeFavorite(storeFavorite.id) : saveFavorite('restaurant', selected.id, 1)}>{storeFavorite ? '★ 店舗を解除' : '☆ 店舗をお気に入り'}</ActionButton></div>
      {!storeItems.length ? <p className="catalog-note">メニューデータは今後追加予定です。</p> : <><label className="field"><span>{selected.name}の商品を検索</span><input type="search" value={storeQuery} onChange={e => { setStoreQuery(e.target.value); setLimit(35); }} /></label>
      {!storeQuery && <><h3>最近食べたもの</h3>{menuRows(recentMenuIds.flatMap(id => storeItems.find(i => i.id === id) ?? []), false)}<h3>お気に入りメニュー</h3>{menuRows(favoriteMenus, false)}</>}
      <label className="field"><span>商品のカテゴリー</span><select value={menuCategory} onChange={e => { setMenuCategory(e.target.value); setLimit(35); }}><option value="">すべて</option>{[...new Set(storeItems.map(i => i.category))].map(c => <option key={c}>{c}</option>)}</select></label><h3>商品一覧</h3>{menuRows(searchMenus(storeItems.filter(i => !menuCategory || i.category === menuCategory), restaurants, storeQuery))}</>}</>
    : <><h3>外食</h3><label className="field"><span className="sr-only">店名・メニュー名を検索</span><input type="search" placeholder="店名・メニュー名を検索" value={query} onChange={e => { setQuery(e.target.value); setLimit(35); }} /></label>
      {query ? <><h3>店舗の検索結果</h3>{storeRows(searchRestaurants(restaurants, query))}<h3>全チェーンの商品検索</h3>{menuRows(searchMenus(items, restaurants, query))}</>
      : <><h3>最近使った店</h3>{storeRows(recentRestaurants(meals).slice(0,4).flatMap(r => restaurants.find(s => s.id === r.id) ?? []))}<h3>お気に入り店舗</h3>{storeRows(restaurants.filter(s => favorites.some(f => f.kind === 'restaurant' && f.sourceId === s.id)))}<h3>お気に入りメニュー</h3>{menuRows(favoriteMenus, false)}<h3>カテゴリー</h3><div className="choice-grid"><button aria-pressed={!category} onClick={() => setCategory('')}>すべて</button>{[...new Set(restaurants.map(s => s.category))].map(c => <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</div><h3>すべてのチェーン</h3>{storeRows(restaurants.filter(s => !category || s.category === category))}</>}</>}
    <p role="status" className="help">{notice}</p>
    {!review && cart.length > 0 && <div className="restaurant-cart-bar"><div><strong>今回の食事 {cart.reduce((n,line) => n + line.quantity, 0)}品</strong><span>{formatNumber(cartTotal(cart).calories, true)} kcal</span></div><button className="button primary" onClick={() => setReview(true)}>内容を確認</button></div>}
  </div>;
}

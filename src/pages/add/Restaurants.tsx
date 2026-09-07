import { useSheetTop } from '../../components/CatalogParts';
import { useState } from 'react';
import { restaurants } from '../../data/restaurants';
import { normalizeSearch } from '../../domain/foods';
import type { Restaurant } from '../../domain/catalog';
import { BackButton } from '../../components/CatalogParts';
export function Restaurants() {
  const [query, setQuery] = useState(''), [category, setCategory] = useState(''), [selected, setSelected] = useState<Restaurant>();
  useSheetTop(selected?.id ?? 'list');
  if (selected) return <div className="form-stack"><BackButton label="外食一覧へ" onClick={() => setSelected(undefined)} /><h3>{selected.name}</h3><p className="catalog-note">メニューデータは第3段階で追加予定です。</p><p className="help">現在、登録できるメニューはありません。</p></div>;
  const matching = restaurants.filter(item => (!category || category === item.category) && normalizeSearch([item.name, ...item.aliases].join(' ')).includes(normalizeSearch(query)));
  return <div className="form-stack"><h3>外食</h3><label className="field"><span className="sr-only">店名・メニュー名を検索</span><input type="search" placeholder="店名・メニュー名を検索" value={query} onChange={event => setQuery(event.target.value)} /></label><p className="help">現在は店名のみ検索できます。メニューは第3段階で追加予定です。</p><h3>最近使った店</h3><p className="help">まだありません</p><h3>お気に入り店舗</h3><p className="help">店舗のお気に入りはメニュー追加とともに対応予定です。</p><h3>カテゴリー</h3><div className="choice-grid"><button aria-pressed={!category} onClick={() => setCategory('')}>すべて</button>{[...new Set(restaurants.map(item => item.category))].map(value => <button key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</div><h3>すべてのチェーン</h3><div className="catalog-list">{matching.map(item => <button className="catalog-row" key={item.id} onClick={() => setSelected(item)}><strong>{item.name}</strong><span>{item.category} · 今後追加予定</span></button>)}</div>{!matching.length && <p className="help">該当する店舗がありません。</p>}</div>;
}

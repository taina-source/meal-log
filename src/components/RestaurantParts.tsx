import type { RestaurantMenuItem } from '../domain/catalog';
import { nutrientKeys, sourceLabels } from '../domain/restaurantMenus';
import { formatNumber } from '../domain/nutrition';
import { usePfcDecimals } from './CatalogParts';
export function MenuNutrition({ item }: { item: RestaurantMenuItem }) {
  const decimals = usePfcDecimals();
  const number = (value: number | null, pfc = false) => value === null ? '不明' : formatNumber(value, pfc ? decimals : true);
  return <div className="menu-nutrition"><strong>{number(item.calories)} kcal</strong><span>P {number(item.protein, true)} / F {number(item.fat, true)} / C {number(item.carbs, true)} g</span>{[item.protein, item.fat, item.carbs].includes(null) && <span className="catalog-note">PFC情報なし（一部または全部不明）</span>}</div>;
}
export function MenuProvenance({ item }: { item: RestaurantMenuItem }) {
  return <section className="form-stack provenance"><h3>栄養情報・出典</h3><p className="help">公式の1単位当たり。数量を掛けて食事に保存します。</p>{nutrientKeys.map((key, index) => {
    const source = item.nutrientProvenance[key];
    return <div className="provenance-row" key={key}><strong>{['カロリー', 'P たんぱく質', 'F 脂質', 'C 炭水化物'][index]} · {sourceLabels[source.sourceType]}</strong><span>{source.value === null ? `不明（原表：${item.rawNutrients[key] || '空欄'}）` : `${source.value} ${key === 'calories' ? 'kcal' : 'g'}`}</span><a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.sourceTitle} ↗</a><small>公開・更新：{source.publishedOrUpdatedAt ?? '記載なし'} / 取得：{source.retrievedAt}</small>{source.notes.map(note => <small key={note}>{note}</small>)}</div>;
  })}<p className="help">出典リンクを開く場合のみインターネット接続が必要です。アプリ内の検索・登録はオフラインで利用できます。</p></section>;
}

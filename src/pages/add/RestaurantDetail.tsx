import { useState } from 'react';
import type { RestaurantMenuItem } from '../../domain/catalog';
import { BackButton, FavoriteButton, Notes } from '../../components/CatalogParts';
import { MenuNutrition, MenuProvenance } from '../../components/RestaurantParts';
import { isComplete } from '../../domain/restaurantMenus';
export function RestaurantDetail({ variants, initial, onBack, onAdd }: { variants: RestaurantMenuItem[]; initial: RestaurantMenuItem; onBack: () => void; onAdd: (item: RestaurantMenuItem) => void }) {
  const [id, setId] = useState(initial.id);
  const item = variants.find(v => v.id === id) ?? initial;
  return <div className="form-stack"><BackButton label="商品一覧へ" onClick={onBack} /><h3>{item.name}</h3>{item.isLimitedTime && <p className="catalog-note">期間限定</p>}{variants.length > 1 && <fieldset className="segment-field"><legend>サイズ・地域を選択</legend><div className="choice-grid">{variants.map(v => <button key={v.id} aria-pressed={id === v.id} onClick={() => setId(v.id)}>{v.variantName || '標準'}</button>)}</div></fieldset>}<p className="help">{item.category} {item.variantName}</p><MenuNutrition item={item} /><Notes notes={item.notes} /><FavoriteButton kind="restaurantMenu" sourceId={item.id} quantity={1} /><button className="button primary" disabled={!isComplete(item)} onClick={() => onAdd(item)}>＋ 今回の食事へ追加</button>{!isComplete(item) && <p role="status" className="catalog-note">{item.registrationBlockedReason ?? '栄養値が一部不明のため、集計の誤りを防ぐために登録できません。'}</p>}<MenuProvenance item={item} /></div>;
}

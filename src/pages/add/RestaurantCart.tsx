import type { RestaurantCartLine } from '../../domain/catalog';
import type { MealContext } from '../../data/catalogRepository';
import { mealLabels } from '../../domain/types';
import { restaurants } from '../../data/restaurants';
import { cartTotal } from '../../domain/restaurantMenus';
import { ActionButton, BackButton, NutrientSummary } from '../../components/CatalogParts';
import { registerRestaurantOrder } from '../../data/restaurantRepository';
import { formatNumber } from '../../domain/nutrition';
export function RestaurantCart({ lines, context, onChange, onBack, onSaved }: { lines: RestaurantCartLine[]; context: MealContext; onChange: (line: RestaurantCartLine, quantity: number) => void; onBack: () => void; onSaved: (date: string) => void }) {
  return <div className="form-stack"><BackButton label="商品選びを続ける" onClick={onBack} /><h3>今回の食事</h3>{lines.map(line => <section className="cart-line" key={line.item.id}><p className="help">{restaurants.find(s => s.id === line.item.restaurantId)?.name}</p><h3>{line.item.name}</h3><p>{line.item.variantName}</p><p>{formatNumber(line.item.calories! * line.quantity, true)} kcal</p><div className="quantity-controls"><button aria-label={`${line.item.name}を1つ減らす`} disabled={line.quantity === 1} onClick={() => onChange(line, line.quantity - 1)}>−</button><output aria-label={`${line.item.name}の数量`}>{line.quantity}</output><button aria-label={`${line.item.name}を1つ増やす`} disabled={line.quantity === 99} onClick={() => onChange(line, line.quantity + 1)}>＋</button><button className="danger-subtle" aria-label={`${line.item.name}を削除`} onClick={() => onChange(line, 0)}>削除</button></div></section>)}{!lines.length && <p className="help">商品がありません。商品一覧の＋から追加してください。</p>}<NutrientSummary value={cartTotal(lines)} label="合計" /><p className="help">{context.date} {context.time} · {mealLabels[context.mealType]}に、商品ごとの記録をまとめて保存します。</p><ActionButton disabled={!lines.length} action={async () => { await registerRestaurantOrder(lines, context); onSaved(context.date); }}>{mealLabels[context.mealType]}として登録</ActionButton></div>;
}

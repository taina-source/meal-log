import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Food, MealSet, Recipe } from '../../domain/catalog';
import { mealLabels, mealTypes, type MealType } from '../../domain/types';
import { localTime } from '../../domain/date';
import { db } from '../../data/db';
import { useFoods } from '../../data/foods';
import { createId } from '../../data/id';
import { registerItems } from '../../data/catalogRepository';
import { foodItem } from '../../domain/foods';
import { recentItems } from '../../domain/recents';
import { BackButton } from '../../components/CatalogParts';
import { FormError } from '../../components/Fields';
import { MealForm } from '../MealForm';
import { FoodPicker } from './FoodPicker';
import { RecipeLibrary } from './RecipeLibrary';
import { SetLibrary } from './SetLibrary';
import { Favorites, RecentList, type CatalogReference } from './Favorites';
import { QuickEntry } from './QuickEntry';
import { Restaurants } from './Restaurants';
type Route = { screen: 'hub' | 'favorites' | 'quick' | 'manual' | 'restaurants'; restaurantId?: string } | { screen: 'foods'; food?: Food; grams?: number } | { screen: 'recipes'; recipe?: Recipe; fraction?: number } | { screen: 'sets'; set?: MealSet };
export function AddMealFlow({ date: initialDate, initialType, onSaved }: { date: string; initialType: MealType; onSaved: (date: string) => void }) {
  const [date, setDate] = useState(initialDate), [time, setTime] = useState(localTime()), [mealType, setMealType] = useState(initialType);
  const [route, setRoute] = useState<Route>({ screen: 'hub' }), [error, setError] = useState('');
  const { data, error: foodError } = useFoods();
  const recipes = useLiveQuery(() => db.recipes.toArray(), []) ?? [];
  const sets = useLiveQuery(() => db.mealSets.toArray(), []) ?? [];
  const recent = useLiveQuery(async () => recentItems(await db.meals.toArray()), []) ?? [];
  const foods = data?.foods ?? [];
  const context = { date, time, mealType };
  const navigate = (next: Route) => { setError(''); setRoute(next); document.querySelector('dialog')?.scrollTo({ top: 0 }); };
  function select(reference: CatalogReference) {
    if (reference.kind === 'restaurant' || reference.kind === 'restaurantMenu') { navigate({ screen: 'restaurants', restaurantId: reference.sourceId }); return; }
    if (reference.kind === 'food') {
      const food = foods.find(item => item.id === reference.sourceId);
      if (food) { navigate({ screen: 'foods', food, grams: reference.quantity }); return; }
    } else if (reference.kind === 'recipe') {
      const recipe = reference.recent?.item?.recipeSnapshot ?? recipes.find(item => item.id === reference.sourceId);
      if (recipe) { navigate({ screen: 'recipes', recipe, fraction: reference.quantity }); return; }
    } else {
      const set = reference.recent?.setSnapshot ?? sets.find(item => item.id === reference.sourceId);
      if (set) { navigate({ screen: 'sets', set }); return; }
    }
    setError('元データが見つかりません。食品データの読み込みを確認してください。');
  }
  if (route.screen === 'manual') return <div className="form-stack"><BackButton label="追加方法へ" onClick={() => navigate({ screen: 'hub' })} /><MealForm date={date} initialType={mealType} initialTime={time} onSaved={onSaved} /></div>;
  return <div className="form-stack add-flow">{route.screen !== 'hub' && <BackButton label="追加方法へ" onClick={() => navigate({ screen: 'hub' })} />}<fieldset className="segment-field"><legend className="sr-only">食事区分</legend><div className="segmented">{mealTypes.map(type => <button type="button" key={type} aria-pressed={mealType === type} className={type === mealType ? 'selected' : ''} onClick={() => setMealType(type)}>{mealLabels[type]}</button>)}</div></fieldset><details className="catalog-details"><summary>{date} · {time}（日付・時刻を変更）</summary><div className="two-columns"><label className="field"><span>登録日</span><input type="date" value={date} min="1900-01-01" max="2100-12-31" onChange={event => setDate(event.target.value)} /></label><label className="field"><span>登録時刻</span><input type="time" value={time} onChange={event => setTime(event.target.value)} /></label></div></details><FormError message={error} /><FormError message={foodError} />{route.screen === 'hub' && <><section className="form-stack"><h3>最近使ったもの</h3><RecentList items={recent.slice(0, 4)} onSelect={select} /></section><h3>追加方法</h3><div className="method-grid">{([
    ['食品を検索', 'foods', '重量からかんたん計算'], ['外食', 'restaurants', '7チェーンの公式メニュー'], ['レシピ', 'recipes', '材料と食数で計算'], ['お気に入り・履歴', 'favorites', 'よく使うものから'], ['いつものセット', 'sets', '組み合わせを一度に'], ['かんたん入力', 'quick', 'カロリーだけ記録'], ['手動入力', 'manual', '栄養値を自分で入力'],
  ] as const).map(([label, screen, description]) => <button key={screen} onClick={() => navigate({ screen })}><strong>{label}</strong><span>{description}</span></button>)}{['バーコード', '栄養表示を撮影', 'ChatGPTから取り込み'].map(label => <button key={label} disabled><strong>{label}</strong><span>今後追加予定</span></button>)}</div></>}{route.screen === 'foods' && (data ? <FoodPicker key={route.food?.id ?? 'search'} foods={foods} initialFood={route.food} initialGrams={route.grams} onChoose={async (food, grams) => { await registerItems([foodItem(food, grams, createId())], context); onSaved(date); }} /> : <p className="help">食品データを読み込み中…</p>)}{route.screen === 'recipes' && <RecipeLibrary foods={foods} initialRecipe={route.recipe} initialFraction={route.fraction} onChoose={async item => { await registerItems([item], context); onSaved(date); }} />}{route.screen === 'sets' && <SetLibrary foods={foods} initialSet={route.set} onChoose={async set => { await registerItems(set.items, context, set); onSaved(date); }} />}{route.screen === 'favorites' && <Favorites foods={foods} onSelect={select} />}{route.screen === 'quick' && <QuickEntry context={context} onSaved={onSaved} />}{route.screen === 'restaurants' && <Restaurants context={context} onSaved={onSaved} initialId={route.restaurantId} />}</div>;
}

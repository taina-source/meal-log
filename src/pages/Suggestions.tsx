import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { useFoods } from '../data/foods';
import { useRestaurantMenus } from '../data/restaurantMenus';
import { restaurants } from '../data/restaurants';
import { registerSuggestion } from '../data/suggestions';
import { normalSources, restaurantSources, expandForReview, editablePart, type SourcePart } from '../domain/suggestionSources';
import { allGoalsReached, nearGoal, rankSuggestions, remainingTargets, suggestionSections, validGoals, type Suggestion } from '../domain/suggestions';
import { localDate, localTime } from '../domain/date';
import { formatNumber, inferMealType, sumNutrients } from '../domain/nutrition';
import { mealLabels, mealTypes, type Nutrients, type UserSettings } from '../domain/types';
import { ActionButton, BackButton, NutrientSummary, useSheetTop } from '../components/CatalogParts';
import { FormError } from '../components/Fields';
import { Restaurants } from './add/Restaurants';
import type { MealContext } from '../data/catalogRepository';
const labels = { balanced: 'バランス重視', protein: 'たんぱく質重視', usual: 'いつもの食事から' };
function storeName(p: SourcePart) { const s = p.source; return s.kind === 'restaurant' ? restaurants.find(r => r.id === s.item.restaurantId)?.name ?? '' : ''; }
function Remaining({ value, decimals, label }: { value: Nutrients; decimals: boolean; label: string }) {
  const show = (n: number, unit: string) => `${formatNumber(Math.abs(n), decimals)}${unit}${n < 0 ? '超過' : '残り'}`;
  return <div className="help"><strong>{label}</strong><div>{show(value.calories, ' kcal')} · P {show(value.protein, 'g')} / F {show(value.fat, 'g')} / C {show(value.carbs, 'g')}</div></div>;
}
function CandidateRows({ candidates, remaining, decimals, onSelect }: { candidates: Suggestion<SourcePart>[]; remaining: Nutrients; decimals: boolean; onSelect: (c: Suggestion<SourcePart>) => void }) {
  return <div className="catalog-list">{candidates.map(c => <button key={c.id} className="catalog-row" onClick={() => onSelect(c)}><span>{c.parts.length}品</span>{c.parts.map(p => <strong key={p.id}>{p.source.kind === 'restaurant' && `${storeName(p)} · `}{p.name} {formatNumber(p.quantity, true)}{p.unitLabel}{p.source.kind === 'restaurant' && ` · ${p.source.item.variantName} ${p.source.item.servingBasis ?? ''}`}</strong>)}<span>{formatNumber(c.nutrients.calories)} kcal · P {formatNumber(c.nutrients.protein, decimals)} / F {formatNumber(c.nutrients.fat, decimals)} / C {formatNumber(c.nutrients.carbs, decimals)} g</span><Remaining label="追加後の目安" value={remainingTargets(remaining, c.nutrients)} decimals={decimals} /></button>)}{!candidates.length && <p className="help">この条件の候補はありません。</p>}</div>;
}
function RestaurantSuggestions({ remaining, goals, settings, context, onSaved }: { remaining: Nutrients; goals: Nutrients; settings: UserSettings; context: MealContext; onSaved: (date: string) => void }) {
  const { items, error } = useRestaurantMenus();
  const [selected, setSelected] = useState<string>();
  const candidates = useMemo(() => items ? rankSuggestions(restaurantSources(items), remaining, goals, 'balanced', false).slice(0, 5) : [], [items, remaining, goals]);
  if (selected) return <><BackButton label="外食候補へ" onClick={() => setSelected(undefined)} /><Restaurants initialId={selected} context={context} onSaved={onSaved} /></>;
  return <><p className="help">登録可能な単品のみ。詳細・出典を確認して既存カートから登録できます。</p><FormError message={error} />{!items && !error ? <p role="status">外食データを読み込み中…</p> : <CandidateRows candidates={candidates} remaining={remaining} decimals={settings.showPfcDecimals} onSelect={c => { const source = c.parts[0].source; if (source.kind === 'restaurant') setSelected(source.item.id); }} />}</>;
}
function Review({ initial, remaining, settings, context, onBack, onSaved }: { initial: SourcePart[]; remaining: Nutrients; settings: UserSettings; context: MealContext; onBack: () => void; onSaved: (date: string) => void }) {
  const parts = useMemo(() => expandForReview(initial), [initial]);
  const [quantities, setQuantities] = useState(() => parts.map(p => String(p.quantity)));
  let error = '', edited: SourcePart[] = [];
  try { edited = parts.map((p, i) => editablePart(p, quantities[i].trim() ? Number(quantities[i]) : NaN)); } catch (e) { error = (e as Error).message; }
  const total = sumNutrients(edited.map(p => p.nutrients));
  useSheetTop('suggestion-review');
  return <div className="form-stack"><BackButton label="候補へ戻る" onClick={onBack} /><h3>食事候補の確認</h3><p className="help">量を変えると、候補の栄養値を比例計算します。元の記録やお気に入りは変更しません。</p>{parts.map((p, i) => <label key={p.id} className="field"><span>{p.name} · {p.unitLabel}</span><input aria-label={`${p.name}の量`} type="number" inputMode="decimal" min="0.001" max="10000" step="any" value={quantities[i]} onChange={e => setQuantities(q => q.map((v, j) => i === j ? e.target.value : v))} />{p.source.kind === 'saved' && <span>{p.source.meal.sourceType === 'chatgpt' ? 'ChatGPT由来の保存値' : '手動入力の保存値'}{p.source.meal.chatgptUserModified ? '（ユーザー修正あり）' : ''}</span>}{p.source.kind === 'catalog' && p.source.item.notes?.map(note => <span key={note}>{note}</span>)}</label>)}<FormError message={error} />{!error && <><NutrientSummary value={total} label="登録する合計" /><Remaining value={remainingTargets(remaining, total)} label="追加後の目安" decimals={settings.showPfcDecimals} /></>}<ActionButton disabled={!!error} action={async () => { await registerSuggestion(parts, quantities.map(Number), context); onSaved(context.date); }}>確認して食事に登録</ActionButton></div>;
}
export function Suggestions({ settings, today, onSaved, onSettings }: { settings: UserSettings; today: string; onSaved: (date: string) => void; onSettings: () => void }) {
  const { data: foodData, error: foodError } = useFoods();
  const data = useLiveQuery(async () => ({ meals: await db.meals.toArray(), recipes: await db.recipes.toArray(), sets: await db.mealSets.toArray(), favorites: await db.favorites.toArray() }), []);
  const [showAll, setShowAll] = useState(false), [external, setExternal] = useState(false), [selected, setSelected] = useState<SourcePart[]>();
  const [context, setContext] = useState<MealContext>({ date: today, time: localTime(), mealType: inferMealType() });
  const goals = useMemo(() => ({ calories: settings.calorieTarget, protein: settings.proteinTarget, fat: settings.fatTarget, carbs: settings.carbsTarget }), [settings]);
  const remaining = useMemo(() => remainingTargets(goals, sumNutrients(data?.meals.filter(m => localDate(new Date(m.eatenAt)) === today) ?? [])), [data, today, goals]);
  const parts = useMemo(() => data ? normalSources(foodData?.foods ?? [], data.recipes, data.sets, data.favorites, data.meals, new Date(`${today}T12:00:00`).getTime()) : [], [data, foodData, today]);
  const collapsed = allGoalsReached(remaining) && !showAll;
  const sections = useMemo(() => collapsed ? [] : suggestionSections(parts, remaining, goals), [parts, remaining, goals, collapsed]);
  if (!validGoals(goals)) return <div className="form-stack"><p>食事候補を表示するには、設定でkcal / P / F / Cの目標を設定してください。</p><button className="button secondary" onClick={onSettings}>設定へ</button></div>;
  if (!data) return <p role="status">記録を読み込み中…</p>;
  return <div className="form-stack"><Remaining value={remaining} label="今日の残り" decimals={settings.showPfcDecimals} /><p className="help">今日の記録と現在の目標から、追加する場合の候補を計算しています。</p><FormError message={foodError} />{nearGoal(remaining, goals) && <p className="help">今日の目標にかなり近づいています。</p>}{collapsed ? <><p>今日の設定目標には達しています。追加する場合は候補を表示できます。</p><button className="button secondary" onClick={() => setShowAll(true)}>それでも候補を見る</button></> : <>
    <details className="catalog-details" open={!!selected || external}><summary>登録する食事区分・日時</summary><label className="field"><span>食事区分</span><select value={context.mealType} onChange={e => setContext({ ...context, mealType: e.target.value as MealContext['mealType'] })}>{mealTypes.map(t => <option key={t} value={t}>{mealLabels[t]}</option>)}</select></label><div className="two-columns"><label className="field"><span>登録日</span><input type="date" min="1900-01-01" max="2100-12-31" value={context.date} onChange={e => setContext({ ...context, date: e.target.value })} /></label><label className="field"><span>登録時刻</span><input type="time" value={context.time} onChange={e => setContext({ ...context, time: e.target.value })} /></label></div></details>
    {selected ? <Review initial={selected} remaining={remaining} settings={settings} context={context} onBack={() => setSelected(undefined)} onSaved={onSaved} /> : <>{!foodData && !foodError && <p role="status">食品データを読み込み中…</p>}{sections.map(section => <section className="form-stack" aria-label={labels[section.mode]} key={section.mode}><h3>{labels[section.mode]}</h3><CandidateRows candidates={section.candidates} remaining={remaining} decimals={settings.showPfcDecimals} onSelect={c => setSelected(c.parts)} /></section>)}<details className="catalog-details" onToggle={e => setExternal(e.currentTarget.open)}><summary>外食から探す</summary>{external && <RestaurantSuggestions remaining={remaining} goals={goals} settings={settings} context={context} onSaved={onSaved} />}</details></>}
  </>}</div>;
}

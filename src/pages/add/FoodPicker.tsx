import { useSheetTop } from '../../components/CatalogParts';
import { usePfcDecimals } from '../../components/CatalogParts';
import { formatNumber } from '../../domain/nutrition';
import { useMemo, useState } from 'react';
import type { Food } from '../../domain/catalog';
import { foodNotes, foodNutrients, searchFoods } from '../../domain/foods';
import { ActionButton, BackButton, FavoriteButton, Notes, NutrientSummary } from '../../components/CatalogParts';
import { foodUnits, portionGrams } from '../../domain/foodUnits';
import { NumberField, FormError } from '../../components/Fields';
export function FoodPicker({ foods, onChoose, initialFood, initialGrams = 100, actionLabel = '食事に登録' }: { foods: Food[]; onChoose: (food: Food, grams: number) => unknown | Promise<unknown>; initialFood?: Food; initialGrams?: number; actionLabel?: string }) {
  const [query, setQuery] = useState(''), [limit, setLimit] = useState(40);
  const [selected, setSelected] = useState(initialFood);
  const [grams, setGrams] = useState(String(initialGrams));
  const [unit, setUnit] = useState('g'), [quantity, setQuantity] = useState('1'), [unitGrams, setUnitGrams] = useState('');
  useSheetTop(selected?.id ?? 'search');
  const found = useMemo(() => searchFoods(foods, query), [foods, query]);
  if (selected) {
    const units = foodUnits(selected.id), definition = units.find(option => option.id === unit);
    let nutrients, finalGrams = NaN, error = '';
    try { finalGrams = portionGrams(selected.id, unit, Number(unit === 'g' ? grams : quantity), Number(unitGrams)); nutrients = foodNutrients(selected, finalGrams); } catch (problem) { error = problem instanceof Error ? problem.message : '重量を確認してください。'; }
    return <div className="form-stack"><BackButton label="食品検索へ" onClick={() => setSelected(undefined)} /><h3 className="wrapping-name">{selected.name}</h3><FoodValues food={selected} /><p className="help">重量は皮・骨などを除いた可食部です。生・ゆで・焼きの違いも確認してください。</p><h3>今回食べる量</h3>{units.length > 0 && <label className="field"><span>単位</span><select value={unit} onChange={event => { const next = event.target.value; setUnit(next); setQuantity('1'); setUnitGrams(String(units.find(option => option.id === next)?.gramsPerUnit ?? '')); }}><option value="g">g</option>{units.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}{unit === 'g' ? <><div className="choice-grid">{[50, 100, 150, 200, 250].map(value => <button key={value} type="button" aria-pressed={Number(grams) === value} onClick={() => setGrams(String(value))}>{value}g</button>)}</div><NumberField label="自由入力（重量）" unit="g" value={grams} onChange={setGrams} max={10000} /></> : <><NumberField label="数量" unit={definition?.label ?? ''} value={quantity} onChange={setQuantity} max={10000} /><NumberField label="1単位あたりの換算重量" unit="g" value={unitGrams} onChange={setUnitGrams} required max={10000} /><p className="help">{definition?.note} 換算はアプリの入力目安で、MEXT公式の単位重量ではありません。変更は今回の登録だけに適用します。</p>{Number.isFinite(finalGrams) && <p aria-label="換算後の合計重量">換算後の合計重量：{finalGrams.toLocaleString('ja-JP', { maximumFractionDigits: 6 })} g</p>}</>}<FormError message={error} />{nutrients && <NutrientSummary value={nutrients} />}<Notes notes={foodNotes(selected)} /><FavoriteButton kind="food" sourceId={selected.id} quantity={nutrients ? finalGrams : NaN} /><ActionButton disabled={!nutrients} action={() => onChoose(selected, finalGrams)}>{actionLabel}</ActionButton><p className="help">出典：{selected.sourceVersion}</p></div>;
  }
  return <div className="form-stack"><h3>食品を検索</h3><label className="field"><span className="sr-only">食品を検索</span><input type="search" value={query} placeholder="ご飯、鶏むね、卵など" onChange={event => { setQuery(event.target.value); setLimit(40); }} /></label><div className="choice-grid">{['ご飯', '鶏むね', '卵', '豚肉'].map(word => <button key={word} onClick={() => { setQuery(word); setLimit(40); }}>{word}</button>)}</div><p className="help">{found.length.toLocaleString()}件 · 可食部100gあたり</p><div className="catalog-list">{found.slice(0, limit).map(food => <button className="catalog-row" key={food.id} onClick={() => { setSelected(food); setGrams('100'); setUnit('g'); setQuantity('1'); setUnitGrams(''); }}><strong>{food.name}</strong><FoodValues food={food} compact /></button>)}</div>{found.length === 0 && <p className="help">見つかりません。短い食品名や別名で検索してください。</p>}{found.length > limit && <button className="button secondary" onClick={() => setLimit(limit + 40)}>さらに表示</button>}<p className="source-caption">日本食品標準成分表（八訂）増補2023年から引用・加工。2026年3月27日更新。</p></div>;
}
function FoodValues({ food, compact = false }: { food: Food; compact?: boolean }) {
  const decimals = usePfcDecimals();
  const display = (key: 'protein' | 'fat' | 'carbs') => { const value = food[`${key}Per100g`]; return value === null ? food.raw[key] || '未測定' : food.status[key] === 'estimated' ? `(${formatNumber(value, decimals)})` : formatNumber(value, decimals); };
  return <div className={compact ? 'food-values compact-values' : 'food-values'}>{!compact && <span>100gあたり</span>}<p>{food.raw.calories || '未測定'} kcal</p><span>P {display('protein')} / F {display('fat')} / C {display('carbs')} g</span></div>;
}

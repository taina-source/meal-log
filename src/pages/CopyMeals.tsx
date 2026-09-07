import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDayMeals } from '../data/repository';
import { copyPreviousDay } from '../data/copyMeals';
import { formatDate, shiftDate } from '../domain/date';
import { formatNumber, sumNutrients } from '../domain/nutrition';
import { mealLabels, mealTypes, type MealType } from '../domain/types';
import { ActionButton, BackButton } from '../components/CatalogParts';
export function CopyMeals({ date, onDone }: { date: string; onDone: (message: string) => void }) {
  const [types, setTypes] = useState<MealType[]>(['breakfast', 'lunch']), [confirm, setConfirm] = useState(false), [message, setMessage] = useState('');
  const previous = shiftDate(date, -1);
  const source = useLiveQuery(() => getDayMeals(previous), [previous]);
  const target = useLiveQuery(() => getDayMeals(date), [date]) ?? [];
  if (!source) return <p className="help">食事を読み込み中…</p>;
  const selected = source.filter(meal => types.includes(meal.mealType));
  const duplicates = selected.filter(meal => target.some(entry => entry.copiedFromId === meal.id && entry.copyTargetDate === date)).length;
  return <div className="form-stack"><p>{formatDate(previous)} → {formatDate(date)}</p>{confirm ? <><BackButton label="食事区分を選び直す" onClick={() => setConfirm(false)} /><h3>選択した食事をコピーしますか？</h3><p>{selected.length}件 · {formatNumber(sumNutrients(selected).calories)} kcal</p><p className="catalog-note">既にコピー済みの{duplicates}件は除外します。コピー元の量・栄養値・時刻をそのまま引き継ぎます。</p><ActionButton disabled={selected.length === duplicates} action={async () => { const result = await copyPreviousDay(date, types); if (result.copied) onDone(`${result.copied}件をコピーしました${result.skipped ? `（${result.skipped}件はコピー済み）` : ''}`); else setMessage('すべてコピー済みです。重複登録はしていません。'); }}>確認して表示日にコピー</ActionButton></> : <><h3>前日の食事</h3>{mealTypes.map(type => { const meals = source.filter(meal => meal.mealType === type); return <label className="copy-choice" key={type}><input type="checkbox" disabled={!meals.length} checked={types.includes(type)} onChange={event => setTypes(current => event.target.checked ? [...current, type] : current.filter(value => value !== type))} /><span>{mealLabels[type]}<small>{meals.length}件</small></span><b>{formatNumber(sumNutrients(meals).calories)} kcal</b></label>; })}{!source.length && <p className="help">前日の記録がありません。</p>}<ActionButton disabled={!selected.length} action={() => setConfirm(true)}>選択した食事を表示日にコピー</ActionButton></>}{message && <p role="status">{message}</p>}</div>;
}

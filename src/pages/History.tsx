import { Fragment } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { mealLabels, type MealEntry, type MealType, type UserSettings } from '../domain/types';
import { formatDate, localDate, localTime, relativeDate } from '../domain/date';
import { formatNumber, sumNutrients } from '../domain/nutrition';
import { Icon } from '../components/Icon';
export interface HistoryFilter { date: string; type: MealType }
export function History({ settings, filter, onClearFilter, onSelect, onAdd }: { settings: UserSettings; filter: HistoryFilter | null; onClearFilter: () => void; onSelect: (entry: MealEntry) => void; onAdd: () => void }) {
  const meals = useLiveQuery(() => db.meals.orderBy('eatenAt').reverse().toArray(), []);
  if (meals === undefined) return <p className="loading">記録を読み込み中…</p>;
  const visible = filter ? meals.filter(meal => localDate(new Date(meal.eatenAt)) === filter.date && meal.mealType === filter.type) : meals;
  const grouped = new Map<string, MealEntry[]>();
  visible.forEach(meal => { const date = localDate(new Date(meal.eatenAt)); grouped.set(date, [...(grouped.get(date) ?? []), meal]); });
  return <><div className="page-heading"><p className="eyebrow">YOUR JOURNAL</p><h1>食事の履歴</h1><p className="muted">日々の記録を、少しずつ。</p></div>{filter && <div className="filter-note"><span>{formatDate(filter.date)}・{mealLabels[filter.type]}</span><button onClick={onClearFilter}>すべて表示</button></div>}{visible.length === 0 ? <div className="card empty-state"><Icon name="history" size={36} /><h2>まだ食事の記録がありません</h2><p>最初の食事を記録してみましょう。</p><button className="button primary" onClick={onAdd}>食事を追加</button></div> : [...grouped].map(([date, entries]) => <section className="history-group" key={date}><div className="section-heading"><h2>{relativeDate(date)}</h2><span>{formatNumber(sumNutrients(entries).calories)} kcal</span></div><div className="card">{entries.map((entry, index) => <Fragment key={entry.id}>{entry.restaurantOrderId && entries.findIndex(e => e.restaurantOrderId === entry.restaurantOrderId) === index && <div className="restaurant-order-heading">{[...new Set(entries.filter(e => e.restaurantOrderId === entry.restaurantOrderId).map(e => e.restaurant))].join('・')} · 同じ外食 {formatNumber(sumNutrients(entries.filter(e => e.restaurantOrderId === entry.restaurantOrderId)).calories)} kcal</div>}<button className="history-row" key={entry.id} onClick={() => onSelect(entry)}><span className={`meal-icon ${entry.mealType}`}><Icon name={entry.mealType} /></span><span className="history-copy"><span className="history-meta">{mealLabels[entry.mealType]}<span>{localTime(new Date(entry.eatenAt))}</span></span>{entry.restaurant && <span className="muted">{entry.restaurant}</span>}<strong>{entry.name}</strong><span className="history-calories">{formatNumber(entry.calories)} <small>kcal</small></span><span className="history-pfc">P {formatNumber(entry.protein, settings.showPfcDecimals)} / F {formatNumber(entry.fat, settings.showPfcDecimals)} / C {formatNumber(entry.carbs, settings.showPfcDecimals)} g</span></span><Icon name="chevron-right" size={18} /></button></Fragment>)}</div></section>)}</>;
}

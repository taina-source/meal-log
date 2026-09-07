import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { getDayMeals } from '../data/repository';
import { mealLabels, mealTypes, type MealType, type UserSettings } from '../domain/types';
import { formatDate, localDate, shiftDate } from '../domain/date';
import { formatNumber, remainingLabel, sumNutrients } from '../domain/nutrition';
import { Icon } from '../components/Icon';
import { PfcCards, Progress } from '../components/Nutrition';
export function Home({ date, setDate, settings, onAdd, onHistory, onWeight, onCopy, onComingSoon }: { date: string; setDate: (date: string) => void; settings: UserSettings; onAdd: (type?: MealType) => void; onHistory: (type: MealType) => void; onWeight: (weight?: number) => void; onCopy: () => void; onComingSoon: () => void }) {
  const meals = useLiveQuery(() => getDayMeals(date), [date]);
  const weight = useLiveQuery(() => db.weights.where('date').equals(date).first(), [date]);
  const totals = sumNutrients(meals ?? []);
  const remaining = settings.calorieTarget - totals.calories;
  const today = date === localDate();
  return <>
    <div className="date-row"><button className="icon-button" aria-label="前日" disabled={date <= '1900-01-01'} onClick={() => setDate(shiftDate(date, -1))}><Icon name="chevron-left" size={20} /></button><div><strong>{formatDate(date)}</strong><span>{new Date(`${date}T12:00:00`).toLocaleDateString('ja-JP', { weekday: 'long' })}</span></div><button className="icon-button" aria-label="翌日" disabled={date >= '2100-12-31'} onClick={() => setDate(shiftDate(date, 1))}><Icon name="chevron-right" size={20} /></button><button className={`today-button ${today ? 'is-today' : ''}`} onClick={() => setDate(localDate())}>今日</button></div>
    <section className="calorie-card card" aria-label="カロリーの残り"><div className="card-kicker"><span className="status-dot" />{today ? '今日のカロリー' : 'この日のカロリー'}<span className="small-badge">kcal</span></div>{meals === undefined ? <p className="loading">読み込み中…</p> : <><div className={`calorie-hero ${remaining < 0 ? 'over-text' : ''}`}><span>{remaining < 0 ? '目標より' : '残り'}</span><div><strong>{formatNumber(Math.abs(remaining))}</strong><span>kcal{remaining < 0 && <b> オーバー</b>}</span></div></div><div className="calorie-meta"><p><b>{formatNumber(totals.calories)}</b><span> / {formatNumber(settings.calorieTarget)} kcal</span></p><span>{Math.round(totals.calories / settings.calorieTarget * 100)}%</span></div><Progress value={totals.calories} target={settings.calorieTarget} label="摂取カロリー" /><div className="progress-caption"><span>摂取済み</span><span>1日の目標</span></div></>}</section>
    <PfcCards totals={totals} settings={settings} />
    <button className="button primary add-meal" onClick={() => onAdd()}><Icon name="plus" />食事を追加</button>
    <div className="home-shortcuts"><button disabled={date <= '1900-01-01'} onClick={onCopy}>{today ? '昨日の食事をコピー' : '前日の食事をコピー'}</button><button onClick={() => onAdd()}>最近使ったものから追加</button></div><section className="meal-section"><div className="section-heading"><h2>{today ? '今日の食事' : 'この日の食事'}</h2><span>{meals?.length ?? 0}件の記録</span></div><div className="card meal-list">{mealTypes.map(type => {
      const items = (meals ?? []).filter(meal => meal.mealType === type);
      return <button className="meal-row" key={type} onClick={() => items.length ? onHistory(type) : onAdd(type)} aria-label={`${mealLabels[type]}${items.length ? 'の記録を見る' : 'を追加'}`}><span className={`meal-icon ${type}`}><Icon name={type} /></span><span className="meal-copy"><span className="meal-title"><strong>{mealLabels[type]}</strong>{items.length > 0 && <span>{formatNumber(sumNutrients(items).calories)} <small>kcal</small></span>}</span><span className="meal-summary">{items.length ? items.map(meal => meal.name).join('、') : 'まだ登録されていません'}</span></span><Icon name={items.length ? 'chevron-right' : 'plus'} size={18} /></button>;
    })}</div></section>
    <section className="remaining-card"><div className="remaining-heading"><span className="soft-icon"><Icon name="leaf" size={20} /></span><h2>{today ? '今日の残り' : 'この日の残り'}</h2><span className="small-badge">PFC</span></div><p className="remaining-calories">{formatNumber(Math.abs(remaining))}<span> kcal{remaining < 0 ? ' オーバー' : ''}</span></p><p className="remaining-macros">{(['P', 'F', 'C'] as const).map((label, index) => <span key={label}>{label} {remainingLabel([totals.protein, totals.fat, totals.carbs][index], [settings.proteinTarget, settings.fatTarget, settings.carbsTarget][index], 'g', settings.showPfcDecimals).replace(/^あと/, '')}</span>)}</p><button className="suggestion-button" onClick={onComingSoon}><span>残りPFCから食事を提案</span><span className="coming-tag">近日追加</span><Icon name="chevron-right" size={16} /></button></section>
    <section className="card weight-card"><span className="soft-icon neutral"><Icon name="scale" /></span><div><h2>{today ? '今日の体重' : 'この日の体重'}</h2><p>{weight ? <><strong>{formatNumber(weight.weight, true)}</strong><span> kg</span></> : <span className="muted">未記録</span>}</p></div><button className="button small secondary" onClick={() => onWeight(weight?.weight)}>記録</button></section>
    <p className="footer-note">毎日の記録を、あなたのペースで。</p>
  </>;
}

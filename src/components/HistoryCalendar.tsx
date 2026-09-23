import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { buildMonthCalendar, shiftMonth } from '../domain/calendar';
import { formatDate, localDate } from '../domain/date';
import { formatNumber } from '../domain/nutrition';
import type { MealEntry } from '../domain/types';
import '../styles/calendar.css';

export function HistoryCalendar({ meals, initialDate, onDay }: { meals: MealEntry[]; initialDate?: string; onDay: (date: string) => void }) {
  const [month, setMonth] = useState(() => (initialDate || localDate()).slice(0, 7));
  const weights = useLiveQuery(() => db.weights.where('date').between(`${month}-01`, `${shiftMonth(month, 1)}-01`, true, false).toArray(), [month]);
  const cells = useMemo(() => buildMonthCalendar(month, meals, weights ?? []), [month, meals, weights]);
  const today = localDate();
  return <section className="card month-calendar" aria-label="月カレンダー">
    <div className="calendar-heading"><button className="button secondary" onClick={() => setMonth(shiftMonth(month, -1))}>前月</button><h2 aria-live="polite">{Number(month.slice(0, 4))}年{Number(month.slice(5))}月</h2><button className="button secondary" onClick={() => setMonth(shiftMonth(month, 1))}>次月</button></div>
    <button className="button secondary" onClick={() => setMonth(localDate().slice(0, 7))}>今月</button>
    <p className="help">数値は1日の合計kcal。「測」は身体測定の記録です。</p>
    <div className="calendar-grid">
      {['日','月','火','水','木','金','土'].map(day => <span className="calendar-weekday" key={day}>{day}</span>)}
      {cells.map((day, i) => day ? <button key={day.date} className="calendar-day" aria-current={day.date === today ? 'date' : undefined} aria-label={`${formatDate(day.date)}、${day.mealCount ? `${formatNumber(day.calories!)}キロカロリー` : '食事記録なし'}${day.hasMeasurement ? '、身体測定あり' : ''}`} onClick={() => onDay(day.date)}>
        <strong>{Number(day.date.slice(8))}</strong><span className="calendar-kcal">{day.mealCount ? formatNumber(day.calories!) : ''}</span><span className="calendar-marker">{day.hasMeasurement ? '測' : ''}</span>
      </button> : <span key={`empty-${i}`} aria-hidden="true" />)}
    </div>
  </section>;
}

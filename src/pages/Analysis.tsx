import { useLiveQuery } from 'dexie-react-hooks';
import { getDayMeals } from '../data/repository';
import { localDate } from '../domain/date';
import { formatNumber, sumNutrients } from '../domain/nutrition';
import type { UserSettings } from '../domain/types';
import { PfcCards } from '../components/Nutrition';
import { Icon } from '../components/Icon';
export function Analysis({ settings }: { settings: UserSettings }) {
  const today = localDate();
  const meals = useLiveQuery(() => getDayMeals(today), [today]);
  const totals = sumNutrients(meals ?? []);
  return <><div className="page-heading"><p className="eyebrow">DAILY OVERVIEW</p><h1>分析</h1><p className="muted">今日の栄養バランスを確認。</p></div><section className="card analysis-summary"><span>今日の摂取</span><p><strong>{formatNumber(totals.calories)}</strong> kcal</p><div>目標 <b>{formatNumber(settings.calorieTarget)}</b> kcal</div></section><PfcCards totals={totals} settings={settings} /><div className="future-state"><Icon name="analysis" size={32} /><h2>記録を、これからのヒントに。</h2><p>詳しい分析・グラフは今後追加予定です。</p><span className="small-badge">COMING LATER</span></div></>;
}

import { useState } from 'react';
import { saveAnalysisDisplay } from '../data/analysisDisplay';
import { storageError } from '../data/repository';
import { intakeSeries, normalizeSeries, nutrientLabels, type NutrientSeries } from '../domain/analysisDisplay';
import { analysisPolicy, type DateRange, type MealDay } from '../domain/analysis';
import type { UserSettings } from '../domain/types';
import { AnalysisChart } from './AnalysisChart';

export function IntakeChart({ records, range, settings }: { records: MealDay[]; range: DateRange; settings: UserSettings }) {
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const visibility = normalizeSeries(settings.analysisSeries);
  const series = intakeSeries(records,analysisPolicy(settings),visibility);
  async function toggle(key: NutrientSeries, checked: boolean) {
    setBusy(true);setError('');
    try { await saveAnalysisDisplay({series:{...visibility,[key]:checked}}); }
    catch(error) { setError(storageError(error)); } finally { setBusy(false); }
  }
  return <><div className="analysis-series" role="group" aria-label="グラフの表示項目">{(Object.keys(nutrientLabels) as NutrientSeries[]).map(key=><label key={key}><input type="checkbox" checked={visibility[key]} disabled={busy} onChange={e=>toggle(key,e.target.checked)}/>{nutrientLabels[key]}{key!=='calories' && ' (g)'}</label>)}</div>
    {error && <p role="alert">{error}</p>}
    {!series.length ? <p className="analysis-empty">表示する項目を選択してください</p> : <AnalysisChart title="日別摂取カロリー・PFC" range={range} zero unit={visibility.calories?'kcal':'g'} target={visibility.calories?settings.calorieTarget:undefined} series={series}/>}
  </>;
}

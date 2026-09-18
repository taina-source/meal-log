import { measurementFields, measurementSpec, measurementSummary, measurementSeries, measurementValues, dailyMeasurements } from '../domain/measurements';
import type { WeightEntry } from '../domain/types';
import { calendarMovingAverage, within, type DateRange } from '../domain/analysis';
import { formatNumber } from '../domain/nutrition';
import { AnalysisChart } from './AnalysisChart';
export function MeasurementAnalysis({ entries, range }: { entries: WeightEntry[]; range: DateRange }) {
  const rows = dailyMeasurements(entries).filter(row => row.date >= range.start && row.date <= range.end);
  return <>{(['bodyFatPercent', 'waistCm'] as const).map(field => {
    const summary = measurementSummary(entries, field, range), spec = measurementSpec[field];
    const averages = calendarMovingAverage(measurementSeries(entries, field)).filter(point => within(point.date, range));
    const latestAverage = averages.at(-1);
    return <section key={field} className="card analysis-block" aria-label={`${spec.label}概要`}><h2>{spec.label}</h2>{summary.latest ? <>
      <p>期間内の最新（{summary.latest.date}）</p><p className="analysis-number">{formatNumber(summary.latest.value, true)} <span>{spec.unit}</span></p>
      <p>期間内の最初：{formatNumber(summary.first.value, true)}{spec.unit}（{summary.first.date}）</p>
      <p>期間内の変化：{summary.change === null ? '比較するには2日以上の記録が必要です' : `${summary.change > 0 ? '+' : ''}${formatNumber(summary.change, true)}${field === 'bodyFatPercent' ? 'ポイント' : spec.unit}`}</p>
    </> : <p>この期間の{spec.label}は未記録です。</p>}
      <p>最新の7日平均：{latestAverage ? `${formatNumber(latestAverage.average, true)}${spec.unit}（${latestAverage.count}件）` : '—'}</p>
      <AnalysisChart title={`${spec.label}推移`} range={range} unit={spec.unit} series={[{ name: '実測', points: summary.records }, { name: '7日移動平均', dashed: true, points: averages.map(point => ({ date: point.date, value: point.average })) }]} />
      <p className="analysis-note">各実測日を含む過去7暦日の実測だけで平均します（1件から計算）。期間直前6日も参照し、未記録日は0にせず補間しません。食事の低カロリー日除外は適用しません。</p>
    </section>;
  })}{!!rows.length && <section className="card analysis-block"><details><summary>身体測定の日別データ</summary><table><caption>— は未記録</caption><thead><tr><th>日付</th>{measurementFields.map(field => <th key={field}>{measurementSpec[field].label}<small>{measurementSpec[field].unit}</small></th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}><th>{row.date.slice(2).replaceAll('-', '/')}</th>{measurementFields.map(field => <td key={field}>{measurementValues(row)[field] === undefined ? '—' : formatNumber(measurementValues(row)[field]!, true)}</td>)}</tr>)}</tbody></table></details></section>}</>;
}

import { measurementFields, measurementSpec, measurementSummary, measurementValues, dailyMeasurements } from '../domain/measurements';
import type { WeightEntry } from '../domain/types';
import type { DateRange } from '../domain/analysis';
import { formatNumber } from '../domain/nutrition';
import { AnalysisChart } from './AnalysisChart';
export function MeasurementAnalysis({ entries, range }: { entries: WeightEntry[]; range: DateRange }) {
  const rows = dailyMeasurements(entries).filter(row => row.date >= range.start && row.date <= range.end);
  return <>{(['bodyFatPercent', 'waistCm'] as const).map(field => {
    const summary = measurementSummary(entries, field, range), spec = measurementSpec[field];
    return <section key={field} className="card analysis-block" aria-label={`${spec.label}概要`}><h2>{spec.label}</h2>{summary.latest ? <>
      <p>期間内の最新（{summary.latest.date}）</p><p className="analysis-number">{formatNumber(summary.latest.value, true)} <span>{spec.unit}</span></p>
      <p>期間内の最初：{formatNumber(summary.first.value, true)}{spec.unit}（{summary.first.date}）</p>
      <p>期間内の変化：{summary.change === null ? '比較するには2日以上の記録が必要です' : `${summary.change > 0 ? '+' : ''}${formatNumber(summary.change, true)}${field === 'bodyFatPercent' ? 'ポイント' : spec.unit}`}</p>
    </> : <p>この期間の{spec.label}は未記録です。</p>}
      <AnalysisChart title={`${spec.label}推移`} range={range} unit={spec.unit} series={[{ name: '実測', points: summary.records }]} />
      <p className="analysis-note">値のある日のみ表示し、未記録日は補間しません。食事の低カロリー日除外は適用しません。</p>
    </section>;
  })}{!!rows.length && <section className="card analysis-block"><details><summary>身体測定の日別データ</summary><table><caption>— は未記録</caption><thead><tr><th>日付</th>{measurementFields.map(field => <th key={field}>{measurementSpec[field].label}<small>{measurementSpec[field].unit}</small></th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}><th>{row.date.slice(2).replaceAll('-', '/')}</th>{measurementFields.map(field => <td key={field}>{measurementValues(row)[field] === undefined ? '—' : formatNumber(measurementValues(row)[field]!, true)}</td>)}</tr>)}</tbody></table></details></section>}</>;
}

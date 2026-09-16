import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { measurementFields, measurementSpec, measurementSummary, measurementValues } from '../domain/measurements';
import { healthCounts, healthMeasurements } from '../domain/healthExport';
import { formatNumber } from '../domain/nutrition';
export function MeasurementHome({ date, onRecord, onHealth }: { date: string; onRecord: () => void; onHealth: () => void }) {
  const data = useLiveQuery(async () => ({ entries: await db.weights.toArray(), pending: (await db.settings.get('user'))?.pendingHealthExport }), []);
  const entries = data?.entries ?? [], current = entries.find(row => row.date === date);
  const counts = healthCounts(healthMeasurements(entries));
  return <section className="card settings-card form-stack" aria-label="身体測定"><h2>身体測定</h2>
    <p>{date}：{current ? measurementFields.filter(key => measurementValues(current)[key] !== undefined).map(key => `${measurementSpec[key].label} ${formatNumber(measurementValues(current)[key]!, true)}${measurementSpec[key].unit}`).join(' / ') : '未記録'}</p>
    <button className="button secondary" onClick={onRecord}>記録</button>
    <details><summary>最新の身体測定（表示日まで）</summary>{measurementFields.map(field => {
      const latest = measurementSummary(entries.filter(row => row.date <= date), field).latest;
      return latest ? <p key={field}>{measurementSpec[field].label} {formatNumber(latest.value, true)}{measurementSpec[field].unit} <small>（{latest.date}）</small></p> : null;
    })}</details>
    <button className="button secondary" onClick={onHealth}>ヘルスケアへ共有</button>
    <p className="help">未共有 {counts.days}日分・{counts.fields}項目{data?.pending && ' · 共有確認待ちがあります'}</p>
  </section>;
}

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { beginHealthExport, finishHealthExport } from '../data/healthExport';
import { healthFields, supportedHealthBatch, healthCounts, healthMeasurements, healthRange, healthShortcutUrl, isHealthShared, type HealthScope } from '../domain/healthExport';
import { measurementSpec, measurementValues } from '../domain/measurements';
import { localDate } from '../domain/date';
import { ActionButton } from '../components/CatalogParts';
import { formatNumber } from '../domain/nutrition';
export function HealthShare() {
  const today = localDate();
  const [scope, setScope] = useState<HealthScope>('all'), [start, setStart] = useState(today), [end, setEnd] = useState(today), [resend, setResend] = useState(false), [message, setMessage] = useState('');
  const data = useLiveQuery(async () => ({ entries: await db.weights.toArray(), pending: (await db.settings.get('user'))?.pendingHealthExport }), []);
  if (!data) return <p>読み込み中…</p>;
  const pending = data.pending ? { ...data.pending, payload: supportedHealthBatch(data.pending.payload) } : undefined;
  let error = '', range: ReturnType<typeof healthRange>, rows: ReturnType<typeof healthMeasurements> = [];
  try { range = healthRange(scope, today, start, end); rows = healthMeasurements(data.entries, range, resend); } catch (e) { error = e instanceof Error ? e.message : '期間を確認してください。'; }
  const total = healthCounts(healthMeasurements(data.entries)), count = healthCounts(rows), pendingCount = pending ? healthCounts(pending.payload.measurements) : null;
  const json = pending ? JSON.stringify(pending.payload) : '';
  async function copy() {
    if (!pendingCount?.fields) { setMessage('共有対象の体重・体脂肪率がありません。確認待ちをキャンセルしてください。'); return false; }
    try { if (!navigator.clipboard?.writeText) throw new Error(); await navigator.clipboard.writeText(json); setMessage('JSONをコピーしました。'); return true; }
    catch { setMessage('コピーできませんでした。連携用JSON欄を長押しし、すべて選択して手動コピーしてください。'); return false; }
  }
  return <div className="form-stack health-share"><p>未共有 {total.days}日分・{total.fields}項目</p>
    <p className="help">共有するのは体重・体脂肪率のみです。ウエストはMeal Log内だけで記録・分析します。</p><p className="help">直接同期ではなく「Meal Log Health」ショートカット経由の記録です。初回はショートカット側でヘルスケア書き込み許可が必要です。</p>
    <p className="help">「共有済み」はユーザーが完了を確認した状態です。Meal LogはHealth側のデータや削除・編集を確認しません。</p>
    {pending && pendingCount ? <section className="form-stack" aria-label="共有確認待ち"><h3>ヘルスケアへの共有確認待ち</h3><p>{pendingCount.days}日分・{pendingCount.fields}項目</p><p className="help">前回の共有確認待ちがあります。完了またはキャンセルするまで新しい共有は開始できません。</p>
      <p className="catalog-note">再共有するとヘルスケアに重複して記録される可能性があります。再試行時もHealth側の記録を確認してください。</p>
      <label className="field"><span>連携用JSON（手動コピー可）</span><textarea rows={6} readOnly value={json} onFocus={e => e.target.select()} /></label>
      <ActionButton disabled={!pendingCount.fields} action={async () => { if (await copy()) window.location.href = healthShortcutUrl; }}>ショートカットで共有</ActionButton>
      <ActionButton className="button secondary" disabled={!pendingCount.fields} action={copy}>連携用JSONをコピー</ActionButton>
      <a className="button secondary" href={pendingCount.fields ? healthShortcutUrl : undefined} aria-disabled={!pendingCount.fields}>Meal Log Healthを開く</a>
      <ActionButton className="button secondary" disabled={!pendingCount.fields} action={async () => { if (await copy()) window.location.href = healthShortcutUrl; }}>もう一度ショートカットを開く</ActionButton>
      <p className="help">コピー後の自動起動が使えない場合は、コピーと「Meal Log Healthを開く」を別々に操作してください。ショートカットは別途作成が必要です。</p>
      <p>Healthへの記録を確認できた場合だけ、以下で完了にしてください。</p>
      <ActionButton action={async () => { await finishHealthExport(pending.payload.exportId, true); setMessage('今回の共有を完了にしました。'); }}>今回の共有を完了にする</ActionButton>
      <ActionButton className="button secondary" action={async () => { await finishHealthExport(pending.payload.exportId, false); setMessage('共有確認待ちをキャンセルしました。共有状態は変更していません。'); }}>キャンセル</ActionButton>
    </section> : <>
      <label className="field"><span>共有対象期間</span><select value={scope} onChange={e => setScope(e.target.value as HealthScope)}>{([['all', '未共有のみ（全期間）'], ['today', '今日の未共有'], ['7', '過去7日の未共有'], ['30', '過去30日の未共有'], ['custom', '期間を選択して未共有']] as const).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {scope === 'custom' && <div className="form-stack"><label className="field">開始日<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label><label className="field">終了日<input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label></div>}
      <details><summary>トラブル対応：再共有</summary><label className="health-resend"><input type="checkbox" checked={resend} onChange={e => setResend(e.target.checked)} />この期間をすべて再共有</label><p className="catalog-note">再共有するとヘルスケアに重複して記録される可能性があります。</p></details>
      {resend && <p className="catalog-note">再共有モード：共有済みの値も含めます。Health側で重複する可能性があります。</p>}
      {error ? <p role="alert">{error}</p> : <p>{count.fields ? `${count.days}日分・${count.fields}項目を共有します` : '未共有の身体測定はありません'}</p>}
      <ActionButton className={resend ? 'button secondary' : 'button primary'} disabled={!!error || !count.fields} action={async () => { await beginHealthExport(range, resend); setMessage(''); }}>共有内容を確認</ActionButton>
    </>}
    {message && <p role="status" className="help">{message}</p>}
    <details><summary>日別の共有状態</summary>{data.entries.filter(entry => healthFields.some(field => measurementValues(entry)[field] !== undefined)).sort((a, b) => b.date.localeCompare(a.date)).map(entry => <div key={entry.id}><h3>{entry.date}</h3>{healthFields.map(field => { const value = measurementValues(entry)[field]; return value === undefined ? null : <p key={field}>{measurementSpec[field].label} {formatNumber(value, true)}{measurementSpec[field].unit} · {isHealthShared(entry, field) ? '共有済み' : '未共有'}</p>; })}</div>)}</details>
  </div>;
}

import { maintenanceEstimate } from '../domain/maintenance';
import { analysisPolicy, type MealDay, type WeightDay } from '../domain/analysis';
import { formatNumber } from '../domain/nutrition';
export function MaintenanceCard({ meals, weights, policy }: { meals: MealDay[]; weights: WeightDay[]; policy: ReturnType<typeof analysisPolicy> }) {
  const estimate = maintenanceEstimate(meals, weights, policy);
  const weekly = estimate.weightTrendKgPerDay === null ? null : Number((estimate.weightTrendKgPerDay * 7).toFixed(1));
  return <section className="card analysis-block" aria-label="実績ベース推定維持カロリー"><h2>実績ベース推定維持カロリー</h2>
    <p className="analysis-note">直近30日の実績から推定（上の表示期間とは独立）</p>
    {estimate.range && <p className="analysis-note">{estimate.range.start} ～ {estimate.range.end}（最新体重日）</p>}
    {estimate.rounded !== null ? <p className="analysis-number">約 {formatNumber(estimate.rounded)} <span>kcal / 日</span></p> : <><h3>{estimate.status}</h3>
      {estimate.status === 'データ不足' && <><p>維持カロリーを推定するにはもう少し記録が必要です。</p><ul>{estimate.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></>}
      {estimate.status === '推定保留' && <p>体重変化が大きいため、維持カロリーの推定を保留しています。水分変動などの影響を受けている可能性があります。医学的な危険判定ではなく、推定計算のガードです。</p>}
      {estimate.status === '推定不可' && <p>計算結果を表示できません。摂取量・体重の記録を確認してください。</p>}
    </>}
    <p>平均摂取：{estimate.averageIntakeKcal !== null && Number.isFinite(estimate.averageIntakeKcal) ? formatNumber(estimate.averageIntakeKcal) : '—'} kcal / 日</p>
    <p>体重トレンド：{weekly !== null && Number.isFinite(weekly) ? `${weekly > 0 ? '+' : ''}${formatNumber(weekly === 0 ? 0 : weekly, true)}` : '—'} kg / 週</p>
    <p>分析対象：{estimate.eligibleDays} / 30日</p><p>体重記録：{estimate.weightDays}日 · 最古〜最新の間隔：{estimate.span}日</p>
    <p>データ充足度：{estimate.sufficiency}</p>
    <details><summary>算出方法を見る</summary><p>最新の体重記録日までの30暦日を使用します。食事は現在の分析設定による対象日の平均で、未記録日・除外日は分母に含めません。</p><p>体重トレンドは全ての異なる日付ペアの変化量／日数の中央値（Theil–Sen法）。平均摂取 − 体重トレンド（kg/日）×7700で逆算し、体重変化1kgあたり約7700kcalとして近似します。表示だけ50kcal単位に丸めます。</p><p>最低条件は食事21日・体重8日・体重記録間隔21日。食事24日・体重14日・間隔28日以上で「十分」です。充足度は精度の保証ではありません。</p><p>短期の水分・塩分などで体重は変動します。体重中央値に対し週1.5%を超える体重変化は推定保留とします。厳密なTDEE測定ではなく実績からの推定値です。体脂肪率・ウエストは計算に使用しません。グラフの7日移動平均は別の表示用計算です。</p></details>
  </section>;
}

import { useMemo, useId } from 'react';
import { calorieWeightRelationship, type RelationshipPoint } from '../domain/relationship';
import { analysisPolicy, type DateRange, type MealDay, type WeightDay } from '../domain/analysis';
import { formatNumber } from '../domain/nutrition';
const trend = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)} kg / 週`;
function Scatter({ points }: { points: RelationshipPoint[] }) {
  const id = useId();
  const xs = points.map(p => p.averageCalories), ys = [0, ...points.map(p => p.weightTrendKgPerWeek)];
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const xp = Math.max((xmax - xmin) * .1, 50), yp = Math.max((ymax - ymin) * .1, .1);
  const x = (v: number) => 54 + (v - xmin + xp) / (xmax - xmin + 2 * xp) * 270;
  const y = (v: number) => 156 - (v - ymin + yp) / (ymax - ymin + 2 * yp) * 126;
  return <figure className="analysis-chart"><svg viewBox="0 0 344 202" role="img" aria-labelledby={id}>
    <title id={id}>平均摂取カロリーと体重トレンドの散布図</title>
    <text x="8" y="14">体重トレンド kg/週</text>
    {[ymin, ymax].filter((v, i, a) => a.indexOf(v) === i).map(v => <g key={v}><line className="chart-grid" x1="54" x2="324" y1={y(v)} y2={y(v)} /><text x="48" y={y(v)+4} textAnchor="end">{v.toFixed(2)}</text></g>)}
    <line className="chart-target" x1="54" x2="324" y1={y(0)} y2={y(0)}><title>体重トレンド 0 kg/週</title></line>
    <g className="chart-measured">{points.map(p => <circle key={p.startDate} cx={x(p.averageCalories)} cy={y(p.weightTrendKgPerWeek)} r="4"><title>{p.startDate}〜{p.endDate}：{formatNumber(p.averageCalories)} kcal/日、食事{p.foodDayCount}日、{trend(p.weightTrendKgPerWeek)}、体重{p.weightDayCount}日</title></circle>)}</g>
    <text x="54" y="177">{formatNumber(xmin)}</text><text x="324" y="177" textAnchor="end">{formatNumber(xmax)}</text>
    <text x="189" y="198" textAnchor="middle">平均摂取 kcal/日</text>
  </svg><figcaption>1点＝重複しない7暦日。破線は体重トレンド0。各点の内容は週ごとの詳細で確認できます。</figcaption></figure>;
}
export function RelationshipCard({ meals, weights, range, policy }: { meals: MealDay[]; weights: WeightDay[]; range: DateRange; policy: ReturnType<typeof analysisPolicy> }) {
  const result = useMemo(() => calorieWeightRelationship(meals, weights, range, policy), [meals, weights, range.start, range.end, policy.enabled, policy.threshold]);
  const { points, rho } = result;
  return <section className="card analysis-block" aria-label="摂取カロリーと体重トレンド"><h2>摂取カロリーと体重トレンド</h2>
    <p>分析週：{points.length}週 <span className="analysis-note">（完全7日ブロック{result.blockCount}週中）</span></p>
    {points.length < 5 ? <><h3>データ不足</h3><p className="analysis-note">相関の表示には有効な分析週が5週以上必要です。90日／全期間で確認できます。</p></> : rho === null ? <p>値のばらつきがないため、相関係数を計算できません。</p> : <><p>記録上の相関：ρ = {rho > 0 ? '+' : ''}{rho.toFixed(2)}</p><p className="analysis-note">{Math.abs(rho) < .2 ? 'この期間の記録では、明確な単調な関連は見えにくい状態です。' : rho > 0 ? 'この記録では、平均摂取カロリーが高い週ほど体重トレンドもプラス方向になる傾向がありました。' : 'この記録では、平均摂取カロリーが高い週ほど体重トレンドはマイナス方向になる傾向がありました。'}相関は因果関係を意味しません。</p></>}
    {points.length >= 5 && points.length <= 7 && <p className="analysis-note">分析週が少ないため参考として確認してください。</p>}
    {points.length >= 5 && <Scatter points={points} />}
    <p className="analysis-note">各週は食事分析対象5日以上・体重2日以上かつ記録間隔4日以上が必要です。現在の低カロリー日除外設定を使用し、欠損を0にしません。体重はTheil–Sen法による週あたりのトレンドです。</p>
    {!!points.length && <details><summary>週ごとの詳細</summary>{points.map(p => <div key={p.startDate}><h3>{p.startDate}〜{p.endDate}</h3><p>平均 {formatNumber(p.averageCalories)} kcal/日 · 食事 {p.foodDayCount}日</p><p>体重 {trend(p.weightTrendKgPerWeek)} · 記録 {p.weightDayCount}日（間隔{p.weightSpanDays}日）</p></div>)}</details>}
    <p className="analysis-note">体重は水分・食事内容・測定タイミング等でも変動します。保存された記録上の関連であり、相関は因果関係を示しません。医学的な評価や将来予測ではありません。</p>
  </section>;
}

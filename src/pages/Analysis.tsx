import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { localDate } from '../domain/date';
import { formatNumber } from '../domain/nutrition';
import { analysisRange, dailyMeals, dailyWeights, mealSummary, recentTrends, targetDifference, weightSummary, type AnalysisPeriod } from '../domain/analysis';
import type { UserSettings } from '../domain/types';
import { AnalysisChart } from '../components/AnalysisChart';
import '../styles/analysis.css';

const shortDate = (date: string) => date.replaceAll('-', '/');
const signed = (value: number, decimals = false) => {
  const rounded = Number(value.toFixed(decimals ? 1 : 0));
  return `${rounded > 0 ? '+' : ''}${formatNumber(rounded === 0 ? 0 : rounded, decimals)}`;
};
export function Analysis({ settings }: { settings: UserSettings }) {
  const [period, setPeriod] = useState<AnalysisPeriod>(7);
  const today = localDate();
  const data = useLiveQuery(async () => {
    try { const [meals, weights] = await Promise.all([db.meals.toArray(), db.weights.toArray()]); return { meals, weights, error: false }; }
    catch { return { meals: [], weights: [], error: true }; }
  }, []);
  const mealDays = useMemo(() => dailyMeals(data?.meals ?? []), [data]);
  const weightDays = useMemo(() => dailyWeights(data?.weights ?? []), [data]);
  const range = analysisRange(period, today, [...mealDays, ...weightDays].map(day => day.date));
  const meals = mealSummary(mealDays, range), weight = weightSummary(weightDays, range);
  const difference = targetDifference(meals.average, settings);
  const trends = recentTrends(mealDays, weightDays, today);
  const decimals = settings.showPfcDecimals;
  const pfc = [
    { key: 'protein' as const, label: 'P', target: settings.proteinTarget },
    { key: 'fat' as const, label: 'F', target: settings.fatTarget },
    { key: 'carbs' as const, label: 'C', target: settings.carbsTarget },
  ];
  return <div className="analysis-page">
    <div className="page-heading"><p className="eyebrow">YOUR RECORDS</p><h1>分析</h1><p className="muted">食事と体重を、記録から振り返る。</p></div>
    <div className="analysis-periods" role="group" aria-label="分析期間">{([7, 30, 90, 'all'] as const).map(value => <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value === 'all' ? '全期間' : `${value}日`}</button>)}</div>
    <p className="analysis-note">{shortDate(range.start)} — {shortDate(range.end)}{period === 'all' && '（保存データの最初〜最後）'}</p>
    {!data ? <p role="status">記録を読み込み中…</p> : data.error ? <p role="alert">記録を読み込めませんでした。画面を開き直してください。</p> : <>
      {!meals.recordedDays && !weight.records.length && <p className="analysis-empty" role="status">まだ分析できる記録がありません。ホームで食事や体重を記録してください。</p>}
      <section className="card analysis-block" aria-label="摂取カロリー概要"><h2>摂取カロリー概要</h2>
        <p className="analysis-note">記録日 {meals.recordedDays} / {range.days}日</p>
        <p>平均摂取カロリー</p><p className="analysis-number">{meals.average ? formatNumber(meals.average.calories) : '—'} <span>kcal</span></p>
        <div className="analysis-metrics"><div><span>現在の目標</span><b>{formatNumber(settings.calorieTarget)} kcal</b></div><div><span>平均 − 現在目標</span><b>{difference ? `${signed(difference.calories)} kcal` : '—'}</b></div></div>
        <p className="analysis-note">平均は食事を1件以上記録した日のみ。未記録日は含めません。比較は過去の目標ではなく、現在の設定値です。</p>
      </section>
      <section className="card analysis-block" aria-label="PFC概要"><h2>平均PFC</h2><div className="analysis-pfc">{pfc.map(({ key, label, target }) => <div key={key}><h3>{label}</h3><b>{meals.average ? formatNumber(meals.average[key], decimals) : '—'} g</b><span>現在目標 {formatNumber(target, decimals)} g</span><span>差 {difference ? `${signed(difference[key], decimals)} g` : '—'}</span></div>)}</div></section>
      <section className="card analysis-block"><h2>摂取カロリー推移</h2><AnalysisChart title="日別摂取カロリー" range={range} zero unit="kcal" target={settings.calorieTarget} series={[{ name: '摂取', points: meals.records.map(day => ({ date: day.date, value: day.calories })) }]} />
        <p className="analysis-note">未記録日はデータなし。線をつながず、0 kcalとして扱いません。</p>
        {!!meals.records.length && <details><summary>カロリーの日別データ</summary><table><caption>食事記録のある日の合計</caption><thead><tr><th>日付</th><th>kcal</th></tr></thead><tbody>{meals.records.map(day => <tr key={day.date}><th scope="row">{shortDate(day.date)}</th><td>{formatNumber(day.calories)}</td></tr>)}</tbody></table></details>}
      </section>
      <section className="card analysis-block" aria-label="体重概要"><h2>体重</h2>{weight.latest && weight.first ? <>
        <p>期間内の最新 <span className="analysis-note">{shortDate(weight.latest.date)}</span></p><p className="analysis-number">{formatNumber(weight.latest.weight, true)} <span>kg</span></p>
        <div className="analysis-metrics"><div><span>期間内の最初</span><b>{formatNumber(weight.first.weight, true)} kg</b><small>{shortDate(weight.first.date)}</small></div><div><span>期間内の変化</span><b>{weight.change === null ? '—' : `${signed(weight.change, true)} kg`}</b>{weight.change === null && <small>比較するには2日以上の記録が必要です</small>}</div><div><span>最新の7日移動平均</span><b>{formatNumber(weight.latest.average, true)} kg</b><small>{shortDate(weight.latest.date)}までの7暦日・記録{weight.latest.count}日</small></div></div>
      </> : <p className="analysis-empty">この期間の体重は未記録です。ホームから体重を記録できます。</p>}</section>
      <section className="card analysis-block"><h2>体重推移</h2><AnalysisChart title="実測体重と7日移動平均" range={range} unit="kg" series={[
        { name: '実測', points: weight.records.map(day => ({ date: day.date, value: day.weight })) },
        { name: '7日移動平均', dashed: true, points: weight.records.map(day => ({ date: day.date, value: day.average })) },
      ]} /><p className="analysis-note">各記録日を含む過去7暦日の実測値だけで平均します。期間直前の記録も使用し、未記録日や未来の点は補間しません。</p>
        {!!weight.records.length && <details><summary>体重の日別データ</summary><table><caption>kg / 移動平均に使った記録日数</caption><thead><tr><th>日付</th><th>実測</th><th>7日平均</th></tr></thead><tbody>{weight.records.map(day => <tr key={day.date}><th scope="row">{shortDate(day.date)}</th><td>{formatNumber(day.weight, true)}</td><td>{formatNumber(day.average, true)}<small>（{day.count}日）</small></td></tr>)}</tbody></table></details>}
      </section>
      <section className="card analysis-block" aria-label="最近の傾向"><h2>最近の傾向</h2><p className="analysis-note">選択期間にかかわらず、今日を含む直近7日とその前の7日を比較します。</p>
        <div className="analysis-metrics"><div><b>直近7日</b><small>{shortDate(trends.currentRange.start)}〜{shortDate(trends.currentRange.end)}</small><span>記録 {trends.current.recordedDays} / 7日</span></div><div><b>前の7日</b><small>{shortDate(trends.previousRange.start)}〜{shortDate(trends.previousRange.end)}</small><span>記録 {trends.previous.recordedDays} / 7日</span></div></div>
        <table><caption>記録日の平均（差は直近 − 前）</caption><thead><tr><th>栄養</th><th>直近</th><th>前</th><th>差</th></tr></thead><tbody>{[{ key: 'calories' as const, label: 'kcal' }, ...pfc.map(({ key, label }) => ({ key, label: `${label} g` }))].map(({ key, label }) => <tr key={key}><th scope="row">{label}</th><td>{trends.current.average ? formatNumber(trends.current.average[key], key !== 'calories' && decimals) : '—'}</td><td>{trends.previous.average ? formatNumber(trends.previous.average[key], key !== 'calories' && decimals) : '—'}</td><td>{trends.difference ? signed(trends.difference[key], key !== 'calories' && decimals) : '—'}</td></tr>)}</tbody></table>
        {!trends.difference ? <p className="analysis-note">記録が少ないため傾向判定なし（各期間4日以上が必要です）。</p> : <p className="analysis-note">記録された日どうしの単純な差です。</p>}
        {trends.weight.change !== null && <p>直近7日の体重変化 {signed(trends.weight.change, true)} kg<span className="analysis-note">（記録{trends.weight.records.length}日・{shortDate(trends.weight.first!.date)}〜{shortDate(trends.weight.latest!.date)}）</span></p>}
      </section>
    </>}
  </div>;
}

import { useId } from 'react';
import { calendarDay, type DateRange } from '../domain/analysis';
import { formatNumber } from '../domain/nutrition';
import { chartAxes } from '../domain/chartAxes';

export interface ChartPoint { date: string; value: number; excluded?: boolean }
interface Series { name: string; points: ChartPoint[]; dashed?: boolean; unit?: string; symbol?: string; dash?: string }
export function AnalysisChart({ title, range, series, target, unit, zero = false }: {
  title: string; range: DateRange; series: Series[]; target?: number; unit: string; zero?: boolean;
}) {
  const id = useId();
  const values = series.flatMap(line => line.points.map(point => point.value));
  if (!values.length) return <p className="analysis-empty">この期間のデータはありません。</p>;
  const axes = chartAxes(series, unit, zero, target);
  const { min, max } = axes[0];
  const left = 52, right = axes.length > 1 ? 292 : 330, top = 24, bottom = 156;
  const x = (date: string) => range.days === 1 ? (left + right) / 2 : left + (calendarDay(date) - calendarDay(range.start)) / (range.days - 1) * (right - left);
  const y = (value: number, axisUnit = axes[0].unit) => { const axis = axes.find(a => a.unit === axisUnit) ?? axes[0]; return bottom - (value - axis.min) / (axis.max - axis.min) * (bottom - top); };
  const label = (date: string) => date.slice(2).replaceAll('-', '/');
  return <figure className="analysis-chart">
    <svg viewBox="0 0 344 190" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>{range.start}から{range.end}。未記録日は線をつながず、0として表示しません。{target !== undefined ? `現在の目標${target}${unit}を破線で表示。` : series.some(line => line.dashed) ? '実測は実線・丸印、7日平均は破線・四角印。' : '実測を丸印で表示。'}日別の値は下の日別データで確認できます。</desc>
      {[min, (min + max) / 2, max].map((tick, index) => <g key={index}><line x1={left} x2={right} y1={y(tick)} y2={y(tick)} className="chart-grid" /><text x={left - 7} y={y(tick) + 4} textAnchor="end">{formatNumber(tick, !zero)}</text></g>)}
      <text x={left - 7} y="12" textAnchor="end">{axes[0].unit}</text>
      {axes[1] && <g aria-label={`右軸 ${axes[1].unit}`}><text x={right + 7} y="12">{axes[1].unit}</text>{[axes[1].min,(axes[1].min+axes[1].max)/2,axes[1].max].map((tick,i)=><text key={i} x={right+7} y={y(tick,axes[1].unit)+4}>{formatNumber(tick,!zero)}</text>)}</g>}
      {target !== undefined && <line x1={left} x2={right} y1={y(target)} y2={y(target)} className="chart-target" />}
      {series.map(line => {
        const lineUnit = line.unit ?? unit;
        const ly = (value: number) => y(value, lineUnit);
        const path = line.points.map((point, i) => `${i && calendarDay(point.date) - calendarDay(line.points[i - 1].date) === 1 ? 'L' : 'M'}${x(point.date)},${ly(point.value)}`).join(' ');
        return <g key={line.name} className={line.dashed ? 'chart-average' : 'chart-measured'}>
          <path d={path} fill="none" strokeWidth="2" strokeDasharray={line.dash || (line.dashed ? '5 4' : undefined)} />
          {line.points.map(point => <g key={point.date} transform={`translate(${x(point.date)},${ly(point.value)})`} style={point.excluded ? { fill: 'var(--card)' } : undefined}>
            <title>{point.excluded ? '平均対象外：' : ''}{point.date} {line.name} {formatNumber(point.value, true)}{lineUnit}</title>
            {line.symbol==='▲' ? <path d="M0,-3 L3,3 L-3,3 Z"/> : line.symbol==='◆' ? <path d="M0,-3 L3,0 L0,3 L-3,0 Z"/> : line.symbol==='■' || line.dashed ? <rect x="-2" y="-2" width="4" height="4"/> : <circle r="2.5"/>}
          </g>)}
        </g>;
      })}
      <text x={left} y="180" textAnchor="start">{label(range.start)}</text>
      {range.days > 1 && <text x={right} y="180" textAnchor="end">{label(range.end)}</text>}
    </svg>
    <figcaption>{series.map(line => `${line.symbol ?? (line.dashed ? '■' : '●')} ${line.dash || line.dashed ? '破線' : '実線'}：${line.name} (${line.unit ?? unit})`).join(' / ')}{axes.length > 1 && ' · 左軸 kcal / 右軸 g'}{target !== undefined && ` / 破線：現在の目標 ${formatNumber(target)} kcal`}</figcaption>
  </figure>;
}

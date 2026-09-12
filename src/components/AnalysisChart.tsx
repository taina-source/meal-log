import { useId } from 'react';
import { calendarDay, type DateRange } from '../domain/analysis';
import { formatNumber } from '../domain/nutrition';

export interface ChartPoint { date: string; value: number }
interface Series { name: string; points: ChartPoint[]; dashed?: boolean }
export function AnalysisChart({ title, range, series, target, unit, zero = false }: {
  title: string; range: DateRange; series: Series[]; target?: number; unit: string; zero?: boolean;
}) {
  const id = useId();
  const values = series.flatMap(line => line.points.map(point => point.value));
  if (!values.length) return <p className="analysis-empty">この期間のデータはありません。</p>;
  if (target !== undefined) values.push(target);
  let min = zero ? 0 : values.reduce((a, b) => Math.min(a, b));
  let max = values.reduce((a, b) => Math.max(a, b));
  const padding = Math.max((max - min) * .12, zero ? 100 : .5);
  if (!zero) min -= padding;
  max += padding;
  const left = 52, right = 330, top = 18, bottom = 156;
  const x = (date: string) => range.days === 1 ? (left + right) / 2 : left + (calendarDay(date) - calendarDay(range.start)) / (range.days - 1) * (right - left);
  const y = (value: number) => bottom - (value - min) / (max - min) * (bottom - top);
  const label = (date: string) => date.slice(2).replaceAll('-', '/');
  return <figure className="analysis-chart">
    <svg viewBox="0 0 344 190" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>{range.start}から{range.end}。未記録日は線をつながず、0として表示しません。{target !== undefined ? `現在の目標${target}${unit}を破線で表示。` : '実測は実線・丸印、7日平均は破線・四角印。'}日別の値は下の日別データで確認できます。</desc>
      {[min, (min + max) / 2, max].map((tick, index) => <g key={index}><line x1={left} x2={right} y1={y(tick)} y2={y(tick)} className="chart-grid" /><text x={left - 7} y={y(tick) + 4} textAnchor="end">{formatNumber(tick, !zero)}</text></g>)}
      {target !== undefined && <line x1={left} x2={right} y1={y(target)} y2={y(target)} className="chart-target" />}
      {series.map(line => {
        const path = line.points.map((point, i) => `${i && calendarDay(point.date) - calendarDay(line.points[i - 1].date) === 1 ? 'L' : 'M'}${x(point.date)},${y(point.value)}`).join(' ');
        return <g key={line.name} className={line.dashed ? 'chart-average' : 'chart-measured'}>
          <path d={path} fill="none" strokeWidth="2" strokeDasharray={line.dashed ? '5 4' : undefined} />
          {line.points.map(point => line.dashed ? <rect key={point.date} x={x(point.date) - 2} y={y(point.value) - 2} width="4" height="4"><title>{point.date} {line.name} {formatNumber(point.value, true)}{unit}</title></rect> : <circle key={point.date} cx={x(point.date)} cy={y(point.value)} r="2.5"><title>{point.date} {line.name} {formatNumber(point.value, true)}{unit}</title></circle>)}
        </g>;
      })}
      <text x={left} y="180" textAnchor="start">{label(range.start)}</text>
      {range.days > 1 && <text x={right} y="180" textAnchor="end">{label(range.end)}</text>}
    </svg>
    <figcaption>{unit} · {series.map(line => `${line.dashed ? '■ 破線' : '● 実線'}：${line.name}`).join(' / ')}{target !== undefined && ` / 破線：現在の目標 ${formatNumber(target)} kcal`}</figcaption>
  </figure>;
}

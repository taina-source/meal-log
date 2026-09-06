import type { Nutrients, UserSettings } from '../domain/types';
import { formatNumber, remainingLabel } from '../domain/nutrition';
export function Progress({ value, target, label }: { value: number; target: number; label: string }) {
  const percentage = target > 0 ? Math.min(100, Math.max(0, value / target * 100)) : value > 0 ? 100 : 0;
  return <div className={`progress ${value > target ? 'over' : ''}`} role="progressbar" aria-label={label} aria-valuenow={Math.round(percentage)} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${value} / ${target}`}><span style={{ width: `${percentage}%` }} /></div>;
}
export function PfcCards({ totals, settings }: { totals: Nutrients; settings: UserSettings }) {
  return <div className="pfc-grid">{([
    ['P', 'たんぱく質', totals.protein, settings.proteinTarget, 'protein'],
    ['F', '脂質', totals.fat, settings.fatTarget, 'fat'],
    ['C', '炭水化物', totals.carbs, settings.carbsTarget, 'carbs'],
  ] as const).map(([letter, label, used, target, color]) => <section className={`pfc-card ${color}`} key={letter} aria-label={label}><div className="pfc-label"><strong>{letter}</strong><span>{label}</span></div><p className="pfc-value"><b>{formatNumber(used, settings.showPfcDecimals)}</b><span> / {formatNumber(target, settings.showPfcDecimals)}g</span></p><Progress value={used} target={target} label={label} /><p className={`pfc-remaining ${used > target ? 'over-text' : ''}`}>{remainingLabel(used, target, 'g', settings.showPfcDecimals)}</p></section>)}</div>;
}

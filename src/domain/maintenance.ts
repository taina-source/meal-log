import { analysisRange, calendarDay, mealSummary, within, analysisPolicy, type MealDay, type WeightDay } from './analysis';

export function median(values: number[]): number | null {
  if (!values.length || values.some(value => !Number.isFinite(value))) return null;
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : sorted[mid - 1] / 2 + sorted[mid] / 2;
}
export function theilSenSlope(days: WeightDay[]): number | null {
  if (days.some(day => !Number.isFinite(day.weight) || !Number.isFinite(calendarDay(day.date)))) return null;
  const slopes: number[] = [];
  for (let i = 0; i < days.length; i++) for (let j = i + 1; j < days.length; j++) {
    const distance = calendarDay(days[j].date) - calendarDay(days[i].date);
    if (distance !== 0) slopes.push((days[j].weight - days[i].weight) / distance);
  }
  return median(slopes);
}
export function maintenanceSufficiency(mealDays: number, weightDays: number, span: number) {
  if (mealDays < 21 || weightDays < 8 || span < 21) return 'データ不足' as const;
  return mealDays >= 24 && weightDays >= 14 && span >= 28 ? '十分' as const : '参考' as const;
}
export function maintenanceCalculation(intake: number, slope: number, medianWeight: number) {
  const raw = intake - slope * 7700;
  const weeklyChangePercent = Math.abs(slope * 7) / medianWeight * 100;
  if (![intake, slope, medianWeight, raw, weeklyChangePercent].every(Number.isFinite) || medianWeight <= 0 || raw <= 0) {
    return { status: '推定不可' as const, raw: null, rounded: null, weeklyChangePercent: null };
  }
  if (weeklyChangePercent > 1.5) return { status: '推定保留' as const, raw: null, rounded: null, weeklyChangePercent };
  return { status: '推定可能' as const, raw, rounded: Math.round(raw / 50) * 50, weeklyChangePercent };
}
// Inputs are the existing daily aggregates; no independent intake filter or DB writes.
export function maintenanceEstimate(meals: MealDay[], weights: WeightDay[], policy = analysisPolicy()) {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const end = sorted.at(-1)?.date;
  const range = end ? analysisRange(30, end, []) : null;
  const records = range ? sorted.filter(day => within(day.date, range)) : [];
  const summary = range ? mealSummary(meals, range, policy) : null;
  const eligibleDays = summary?.eligibleDays ?? 0;
  const weightDays = new Set(records.map(day => day.date)).size;
  const span = records.length ? calendarDay(records.at(-1)!.date) - calendarDay(records[0].date) : 0;
  const sufficiency = maintenanceSufficiency(eligibleDays, weightDays, span);
  const averageIntakeKcal = summary?.average?.calories ?? null;
  const weightTrendKgPerDay = theilSenSlope(records);
  const medianWeightKg = median(records.map(day => day.weight));
  const reasons: string[] = [];
  if (!end) reasons.push('体重記録がありません。');
  if (eligibleDays < 21) reasons.push(`食事の分析対象が21日以上必要です（現在${eligibleDays}日）。`);
  if (weightDays < 8) reasons.push(`体重記録が8日以上必要です（現在${weightDays}日）。`);
  if (span < 21) reasons.push(`最古〜最新の体重記録の間隔が21日以上必要です（現在${span}日）。`);
  const calculation = sufficiency === 'データ不足' ? { status: 'データ不足' as const, raw: null, rounded: null, weeklyChangePercent: null }
    : maintenanceCalculation(averageIntakeKcal ?? NaN, weightTrendKgPerDay ?? NaN, medianWeightKg ?? NaN);
  return { ...calculation, sufficiency, range, eligibleDays, weightDays, span, averageIntakeKcal, weightTrendKgPerDay, reasons };
}

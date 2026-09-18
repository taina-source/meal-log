import { analysisPolicy, calendarDay, dateRange, mealSummary, within, type DateRange, type MealDay, type WeightDay } from './analysis';
import { shiftDate } from './date';
import { theilSenSlope } from './maintenance';

export interface RelationshipPoint {
  startDate: string; endDate: string; averageCalories: number; foodDayCount: number;
  weightTrendKgPerWeek: number; weightDayCount: number; weightSpanDays: number;
}
export function weeklyBlocks(range: DateRange): DateRange[] {
  const blocks: DateRange[] = [];
  for (let end = range.end; calendarDay(end) - calendarDay(range.start) >= 6; end = shiftDate(end, -7)) {
    blocks.push(dateRange(shiftDate(end, -6), end));
  }
  return blocks.reverse();
}
export function rankValues(values: number[]): number[] | null {
  if (values.some(value => !Number.isFinite(value))) return null;
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = new Array<number>(values.length);
  for (let i = 0; i < sorted.length;) {
    let end = i + 1;
    while (end < sorted.length && sorted[end].value === sorted[i].value) end++;
    const rank = (i + 1 + end) / 2;
    for (let j = i; j < end; j++) ranks[sorted[j].index] = rank;
    i = end;
  }
  return ranks;
}
export function calculateSpearman(points: { x: number; y: number }[]): number | null {
  if (points.length < 5) return null;
  const x = rankValues(points.map(p => p.x)), y = rankValues(points.map(p => p.y));
  if (!x || !y) return null;
  const mean = (points.length + 1) / 2;
  let covariance = 0, vx = 0, vy = 0;
  for (let i = 0; i < x.length; i++) { const dx = x[i] - mean, dy = y[i] - mean; covariance += dx * dy; vx += dx * dx; vy += dy * dy; }
  if (!vx || !vy) return null;
  const rho = covariance / Math.sqrt(vx * vy);
  return Number.isFinite(rho) ? Math.max(-1, Math.min(1, rho)) : null;
}
export function calorieWeightRelationship(meals: MealDay[], weights: WeightDay[], range: DateRange, policy = analysisPolicy()) {
  const blocks = weeklyBlocks(range);
  const points: RelationshipPoint[] = [];
  for (const block of blocks) {
    const food = mealSummary(meals, block, policy);
    const records = weights.filter(p => within(p.date, block) && Number.isFinite(p.weight)).slice().sort((a, b) => a.date.localeCompare(b.date));
    const weightDayCount = new Set(records.map(p => p.date)).size;
    const span = records.length ? calendarDay(records.at(-1)!.date) - calendarDay(records[0].date) : 0;
    if (food.eligibleDays < 5 || weightDayCount < 2 || span < 4) continue;
    const slope = theilSenSlope(records), average = food.average?.calories;
    if (slope === null || average === undefined || !Number.isFinite(average) || !Number.isFinite(slope * 7)) continue;
    points.push({ startDate: block.start, endDate: block.end, averageCalories: average, foodDayCount: food.eligibleDays,
      weightTrendKgPerWeek: slope * 7, weightDayCount, weightSpanDays: span });
  }
  return { points, blockCount: blocks.length, rho: calculateSpearman(points.map(p => ({ x: p.averageCalories, y: p.weightTrendKgPerWeek }))) };
}

import { isAnalysisDay, analysisPolicy, type MealDay } from './analysis';

export const sectionLabels = {
  maintenance: '実績ベース推定維持カロリー', calories: '摂取カロリー概要', pfc: '平均PFC', intake: '摂取カロリー・PFC推移',
  weight: '体重概要', weightChart: '体重推移', relationship: '摂取カロリーと体重トレンド',
  bodyFat: '体脂肪率', waist: 'ウエスト', measurements: '身体測定の日別データ', trends: '最近の傾向',
} as const;
export type AnalysisSection = keyof typeof sectionLabels;
export const defaultSectionOrder = Object.keys(sectionLabels) as AnalysisSection[];
export const nutrientLabels = { calories: 'kcal', protein: 'P', fat: 'F', carbs: 'C' } as const;
export type NutrientSeries = keyof typeof nutrientLabels;
export type SeriesVisibility = Record<NutrientSeries, boolean>;
export function normalizeSeries(value: unknown): SeriesVisibility {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.keys(nutrientLabels).map(key => [key, typeof input[key] === 'boolean' ? input[key] : key === 'calories'])) as SeriesVisibility;
}
export function normalizeSectionOrder(value: unknown): AnalysisSection[] {
  const known = (Array.isArray(value) ? value : []).filter((id): id is AnalysisSection => typeof id === 'string' && Object.hasOwn(sectionLabels, id));
  return [...new Set([...known, ...defaultSectionOrder])];
}
export function moveSection(value: unknown, id: AnalysisSection, direction: -1 | 1) {
  const order = normalizeSectionOrder(value), from = order.indexOf(id), to = from + direction;
  if (from >= 0 && to >= 0 && to < order.length) [order[from], order[to]] = [order[to], order[from]];
  return order;
}
export function intakeSeries(records: MealDay[], policy: ReturnType<typeof analysisPolicy>, visibility: SeriesVisibility) {
  return (Object.keys(nutrientLabels) as NutrientSeries[]).filter(key => visibility[key]).map(key => ({
    name: nutrientLabels[key], unit: key === 'calories' ? 'kcal' : 'g',
    symbol: ({calories:'●',protein:'■',fat:'▲',carbs:'◆'} as const)[key],
    dash: ({calories:'',protein:'6 3',fat:'2 3',carbs:'8 3 2 3'} as const)[key],
    points: records.map(day => ({date: day.date, value: day[key], excluded: !isAnalysisDay(day, policy)})),
  }));
}

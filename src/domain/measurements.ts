import type { WeightEntry } from './types';
export const measurementFields = ['weightKg', 'bodyFatPercent', 'waistCm'] as const;
export type MeasurementField = typeof measurementFields[number];
export type MeasurementValues = Partial<Record<MeasurementField, number>>;
export const measurementSpec = {
  weightKg: { label: '体重', unit: 'kg', max: 500 },
  bodyFatPercent: { label: '体脂肪率', unit: '%', max: 100 },
  waistCm: { label: 'ウエスト', unit: 'cm', max: 300 },
} as const;
export function measurementValues(entry?: WeightEntry): MeasurementValues {
  if (!entry) return {};
  const values: MeasurementValues = {};
  for (const field of measurementFields) {
    const value = field === 'weightKg' ? entry.weightKg ?? entry.weight : entry[field];
    if (value !== undefined) values[field] = value;
  }
  return values;
}
export function validateMeasurements(values: MeasurementValues): string | undefined {
  if (!measurementFields.some(field => values[field] !== undefined)) return '身体測定は最低1項目を入力してください。';
  for (const field of measurementFields) {
    const value = values[field], spec = measurementSpec[field];
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > spec.max)) return `${spec.label}は0より大きく${spec.max}${spec.unit}以下の数値を入力してください。`;
  }
}
export function measurementDraft(entry?: WeightEntry) {
  const values = measurementValues(entry);
  return { weightKg: values.weightKg?.toString() ?? '', bodyFatPercent: values.bodyFatPercent?.toString() ?? '', waistCm: values.waistCm?.toString() ?? '' };
}
export function dailyMeasurements(entries: WeightEntry[]) {
  const days = new Map<string, WeightEntry>();
  for (const entry of entries) { const old = days.get(entry.date); if (!old || entry.createdAt > old.createdAt || (entry.createdAt === old.createdAt && entry.id > old.id)) days.set(entry.date, entry); }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function measurementSeries(entries: WeightEntry[], field: MeasurementField, range?: { start: string; end: string }) {
  return dailyMeasurements(entries).flatMap(entry => {
    const value = measurementValues(entry)[field];
    return value !== undefined && Number.isFinite(value) && value > 0 && (!range || (entry.date >= range.start && entry.date <= range.end)) ? [{ date: entry.date, value }] : [];
  });
}
export function measurementSummary(entries: WeightEntry[], field: MeasurementField, range?: { start: string; end: string }) {
  const records = measurementSeries(entries, field, range), first = records[0], latest = records.at(-1);
  return { records, first, latest, change: records.length > 1 ? latest!.value - first.value : null };
}

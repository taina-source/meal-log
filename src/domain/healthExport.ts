import { shiftDate } from './date';
import { validLocalDateTime } from './validation';
import { dailyMeasurements, measurementFields, measurementValues, validateMeasurements, type MeasurementField, type MeasurementValues } from './measurements';
import type { WeightEntry } from './types';
export type HealthScope = 'all' | 'today' | '7' | '30' | 'custom';
export interface HealthMeasurement extends MeasurementValues { date: string }
export interface HealthBatch { schemaVersion: 1; type: 'meal-log-health-batch'; exportId: string; measurements: HealthMeasurement[] }
export interface PendingHealthExport { payload: HealthBatch; createdAt: string; mode: 'unshared' | 'all'; recordIds: Record<string, string> }
export const healthShortcutUrl = 'shortcuts://run-shortcut?name=Meal%20Log%20Health';
export function healthRange(scope: HealthScope, today: string, start = today, end = today) {
  if (scope === 'all') return undefined;
  const range = scope === 'custom' ? { start, end } : { start: shiftDate(today, scope === '7' ? -6 : scope === '30' ? -29 : 0), end: today };
  if (!validLocalDateTime(range.start, '12:00') || !validLocalDateTime(range.end, '12:00') || range.start > range.end) throw new Error('開始日と終了日を確認してください。');
  return range;
}
export function isHealthShared(entry: WeightEntry, field: MeasurementField) {
  const value = measurementValues(entry)[field];
  return value !== undefined && entry.healthExport?.[field]?.value === value;
}
export function healthMeasurements(entries: WeightEntry[], range?: { start: string; end: string }, resend = false): HealthMeasurement[] {
  return dailyMeasurements(entries).flatMap(entry => {
    if (range && (entry.date < range.start || entry.date > range.end)) return [];
    const values = measurementValues(entry);
    const row: HealthMeasurement = { date: entry.date };
    for (const field of measurementFields) if (values[field] !== undefined && (resend || !isHealthShared(entry, field))) row[field] = values[field];
    if (Object.keys(row).length === 1) return [];
    const error = validateMeasurements(row);
    if (error || !validLocalDateTime(row.date, '12:00')) throw new Error(error ?? '身体測定の日付を確認してください。');
    return [row];
  });
}
export function healthCounts(rows: HealthMeasurement[]) { return { days: rows.length, fields: rows.reduce((n, row) => n + measurementFields.filter(key => row[key] !== undefined).length, 0) }; }
// exportId/time are supplied by the persistence boundary to keep these functions pure.
export function healthBatch(entries: WeightEntry[], exportId: string, range?: { start: string; end: string }, resend = false): HealthBatch {
  return { schemaVersion: 1, type: 'meal-log-health-batch', exportId, measurements: healthMeasurements(entries, range, resend) };
}
export function pendingHealthExport(entries: WeightEntry[], exportId: string, createdAt: string, range?: { start: string; end: string }, resend = false): PendingHealthExport {
  const payload = healthBatch(entries, exportId, range, resend);
  return { payload, createdAt, mode: resend ? 'all' : 'unshared', recordIds: Object.fromEntries(dailyMeasurements(entries).map(row => [row.date, row.id])) };
}
export function confirmedHealthMetadata(entry: WeightEntry, row: HealthMeasurement, exportedAt: string): WeightEntry['healthExport'] {
  const metadata = { ...entry.healthExport };
  for (const field of measurementFields) if (row[field] !== undefined) metadata[field] = { value: row[field], exportedAt };
  return metadata;
}

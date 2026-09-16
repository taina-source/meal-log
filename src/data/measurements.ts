import { db } from './db';
import { createId } from './id';
import { validateMeasurements, type MeasurementValues } from '../domain/measurements';
import { validLocalDateTime } from '../domain/validation';
export async function saveMeasurement(date: string, values: MeasurementValues) {
  const error = validateMeasurements(values); if (error) throw new Error(error);
  if (!validLocalDateTime(date, '12:00')) throw new Error('日付を確認してください。');
  return db.transaction('rw', db.weights, async () => {
    const previous = await db.weights.where('date').equals(date).first();
    const entry = { ...previous, id: previous?.id ?? createId(), date, createdAt: previous?.createdAt ?? new Date().toISOString(), weightKg: values.weightKg, bodyFatPercent: values.bodyFatPercent, waistCm: values.waistCm };
    // Only this explicitly edited row changes; removing a field must not resurrect legacy weight.
    delete entry.weight;
    await db.weights.put(entry); return entry;
  });
}

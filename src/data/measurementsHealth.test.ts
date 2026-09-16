import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import { db, MealLogDatabase } from './db';
import { saveMeasurement } from './measurements';
import { beginHealthExport, finishHealthExport } from './healthExport';
import { getSettings, saveSettings, saveWeight } from './repository';
import { measurementDraft, measurementFields, measurementSeries, measurementSummary, measurementValues, validateMeasurements, type MeasurementValues } from '../domain/measurements';
import { supportedHealthBatch, healthBatch, healthCounts, healthMeasurements, healthRange, isHealthShared, pendingHealthExport } from '../domain/healthExport';
import { analysisRange, dailyWeights, mealSummary, weightSummary } from '../domain/analysis';
import type { WeightEntry } from '../domain/types';
const date = '2026-09-15', stamp = '2026-09-15T03:00:00.000Z';
const row = (day = date, values: MeasurementValues = { weightKg: 100 }): WeightEntry => ({ id: day, date: day, createdAt: stamp, ...values });
beforeEach(async () => { await db.weights.clear(); await db.settings.clear(); });

it('旧weight-onlyを無変更で読み、prefillと体重分析へ渡す', async () => {
  const legacy = { id: 'legacy', date, weight: 102.8, createdAt: stamp }; await db.weights.add(legacy);
  expect(measurementValues(legacy)).toEqual({ weightKg: 102.8 }); expect(measurementDraft(legacy)).toEqual({ weightKg: '102.8', bodyFatPercent: '', waistCm: '' });
  expect(dailyWeights([legacy])).toEqual([{ date, weight: 102.8 }]); expect(await db.weights.get('legacy')).toEqual(legacy); expect(db.verno).toBe(3);
});
it.each([{ weightKg: 100 }, { bodyFatPercent: 24.123 }, { waistCm: 98.456 }, { weightKg: 100, bodyFatPercent: 24, waistCm: 98 }])('任意指標%sを丸めず保存', async values => {
  const saved = await saveMeasurement(date, values); expect(measurementValues((await db.weights.get(saved.id))!)).toEqual(values);
});
it.each([{}, { weightKg: 0 }, { bodyFatPercent: -1 }, { waistCm: NaN }, { weightKg: Infinity }, { waistCm: 301 }, { weightKg: 501 }, { bodyFatPercent: 101 }, { weightKg: '100' }, { weightKg: null }])('不正な身体測定%sを拒否', async values => {
  expect(validateMeasurements(values as MeasurementValues)).toBeTruthy(); await expect(saveMeasurement(date, values as MeasurementValues)).rejects.toThrow(); expect(await db.weights.count()).toBe(0);
});
it('同日更新でID・未入力以外の値・共有履歴を保持し空欄を除去', async () => {
  await db.weights.add({ id: 'old', date, weight: 100, createdAt: stamp, healthExport: { weightKg: { value: 100, exportedAt: stamp } } });
  const next = await saveMeasurement(date, { bodyFatPercent: 24, waistCm: 98 });
  expect(await db.weights.count()).toBe(1); expect(next.id).toBe('old'); expect(measurementValues(next)).toEqual({ bodyFatPercent: 24, waistCm: 98 });
  expect(next.healthExport?.weightKg?.value).toBe(100); expect(measurementDraft(next)).toEqual({ weightKg: '', bodyFatPercent: '24', waistCm: '98' });
});
it('既存saveWeightの更新でも追加指標・metadataを失わない', async () => {
  await saveMeasurement(date, { weightKg: 100, waistCm: 98 }); const p = await beginHealthExport(); await finishHealthExport(p.payload.exportId, true);
  await saveWeight(date, 99.8); const saved = (await db.weights.toArray())[0]; expect(measurementValues(saved)).toEqual({ weightKg: 99.8, waistCm: 98 }); expect(isHealthShared(saved, 'weightKg')).toBe(false);
});
it('指標別latestは独立し体脂肪率・ウエストのみを0kgにしない', () => {
  const rows = [row('2026-09-12', { bodyFatPercent: 24 }), row('2026-09-14', { waistCm: 98 }), row(date, { weightKg: 100 })];
  expect(measurementFields.map(field => measurementSummary(rows, field).latest?.date)).toEqual([date, '2026-09-12', '2026-09-14']); expect(dailyWeights(rows)).toEqual([{ date, weight: 100 }]);
});
it.each(['bodyFatPercent', 'waistCm'] as const)('%sの期間変化・空・単点・未記録日は補間しない', field => {
  const rows = [row('2026-09-01', { [field]: 30 }), row('2026-09-10', { [field]: 25 }), row(date, { [field]: 24 })], range = analysisRange(7, date, []);
  const summary = measurementSummary(rows, field, range); expect(summary.records.map(r => r.date)).toEqual(['2026-09-10', date]); expect(summary.change).toBe(-1);
  expect(measurementSummary(rows.slice(-1), field, range).change).toBeNull(); expect(measurementSummary([], field).latest).toBeUndefined();
  expect(measurementSeries([row(date, { weightKg: 100 })], field)).toEqual([]);
});
it('低カロリー除外は身体測定に影響せず既存7日体重平均を維持', () => {
  const range = analysisRange(7, date, []), weights = [row('2026-09-10', { weightKg: 100, bodyFatPercent: 24 }), row(date, { weightKg: 98, bodyFatPercent: 23 })];
  expect(mealSummary([{ date, count: 1, calories: 1000, protein: 10, fat: 10, carbs: 10 }], range).eligibleDays).toBe(0);
  expect(weightSummary(dailyWeights(weights), range).latest?.average).toBe(99); expect(measurementSummary(weights, 'bodyFatPercent', range).records).toHaveLength(2);
});
it('項目単位で未共有を抽出、全共有済みは除外・値変更で再対象', () => {
  const entry = { ...row(date, { weightKg: 100, bodyFatPercent: 24, waistCm: 98 }), healthExport: { weightKg: { value: 100, exportedAt: stamp }, bodyFatPercent: { value: 24, exportedAt: stamp } } };
  expect(healthMeasurements([entry])).toEqual([]);
  expect(healthMeasurements([{ ...entry, waistCm: undefined }])).toEqual([]);
  expect(healthMeasurements([{ ...entry, weightKg: 99.8 }])).toEqual([{ date, weightKg: 99.8 }]);
});
it.each([['today', [date]], ['7', ['2026-09-09', date]], ['30', ['2026-08-17', '2026-09-09', date]], ['all', ['2026-08-01', '2026-08-17', '2026-09-09', date]]] as const)('%sのローカル暦日境界を含め昇順に抽出', (scope, expected) => {
  const rows = [date, '2026-09-09', '2026-08-17', '2026-08-01'].map(d => row(d));
  expect(healthBatch(rows, 'fixed', healthRange(scope, date)).measurements.map(r => r.date)).toEqual(expected);
});
it('任意期間の両端を含め不正期間を拒否', () => {
  expect(healthMeasurements([row(date)], healthRange('custom', date, date, date))).toHaveLength(1);
  expect(() => healthRange('custom', date, '2026-09-16', date)).toThrow(); expect(() => healthRange('custom', date, '2026-02-30', date)).toThrow();
});
it('単日でもbatch JSON、数値だけで日数・項目数を数え不要情報を含めない', () => {
  const payload = healthBatch([row(date, { waistCm: 98, weightKg: 100 })], 'fixed');
  expect(JSON.parse(JSON.stringify(payload))).toEqual({ schemaVersion: 1, type: 'meal-log-health-batch', exportId: 'fixed', measurements: [{ date, weightKg: 100 }] });
  expect(healthCounts(payload.measurements)).toEqual({ days: 1, fields: 1 }); expect(healthCounts([])).toEqual({ days: 0, fields: 0 });
});
it('再共有は期間内の現在値だけを対象としmissingは補完しない', () => {
  const entry = { ...row(), healthExport: { weightKg: { value: 100, exportedAt: stamp } } };
  expect(healthBatch([entry, row('2026-09-01')], 'fixed', healthRange('today', date), true).measurements).toEqual([{ date, weightKg: 100 }]);
});
it('pure pending生成は元のrecordを変更しない', () => {
  const entry = row(), before = structuredClone(entry); const p = pendingHealthExport([entry], 'fixed', stamp);
  expect(entry).toEqual(before); expect(p.payload.exportId).toBe('fixed'); expect(p.createdAt).toBe(stamp); expect(p.recordIds[date]).toBe(entry.id);
});
it('pending保存はmetadata不変、再オープンでも同じexportIdを読める', async () => {
  const entry = await saveMeasurement(date, { weightKg: 100 }); const p = await beginHealthExport();
  const reopened = new MealLogDatabase(); await reopened.open();
  try { expect((await reopened.settings.get('user'))?.pendingHealthExport).toEqual(p); expect(await reopened.weights.get(entry.id)).toEqual(entry); } finally { reopened.close(); }
  expect((await getSettings()).pendingHealthExport?.payload).toEqual(p.payload); // retry reads the same immutable payload
});
it('pendingがある場合は新しい共有を上書きしない・通常設定保存でも保持', async () => {
  const stale = await getSettings(); await saveMeasurement(date, { weightKg: 100 }); const p = await beginHealthExport();
  await expect(beginHealthExport()).rejects.toThrow('確認待ち'); await saveSettings({ ...stale, calorieTarget: 2500 });
  expect((await getSettings()).pendingHealthExport).toEqual(p);
});
it('明示confirmだけが項目metadataを更新しpendingを消す', async () => {
  const saved = await saveMeasurement(date, { weightKg: 100, bodyFatPercent: 24 }); const p = await beginHealthExport();
  expect((await db.weights.get(saved.id))?.healthExport).toBeUndefined();
  await finishHealthExport(p.payload.exportId, true); const next = (await db.weights.get(saved.id))!;
  expect(next.healthExport?.weightKg?.value).toBe(100); expect(next.healthExport?.bodyFatPercent?.value).toBe(24); expect(Number.isFinite(Date.parse(next.healthExport!.weightKg!.exportedAt))).toBe(true);
  expect(healthMeasurements([next])).toEqual([]); expect((await getSettings()).pendingHealthExport).toBeUndefined();
});
it('pending後の編集はsnapshot値でconfirmし現在値を未共有のまま残す', async () => {
  const saved = await saveMeasurement(date, { weightKg: 100 }); const p = await beginHealthExport();
  await saveMeasurement(date, { weightKg: 99.8, waistCm: 98 }); await finishHealthExport(p.payload.exportId, true);
  const next = (await db.weights.get(saved.id))!; expect(next.healthExport?.weightKg?.value).toBe(100); expect(healthMeasurements([next])).toEqual([{ date, weightKg: 99.8 }]);
});
it('cancelはmetadata不変、次のexportIdは新規、古い確認は拒否', async () => {
  const saved = await saveMeasurement(date, { weightKg: 100 }); const p = await beginHealthExport(); await finishHealthExport(p.payload.exportId, false);
  expect(await db.weights.get(saved.id)).toEqual(saved); const next = await beginHealthExport(); expect(next.payload.exportId).not.toBe(p.payload.exportId);
  await expect(finishHealthExport(p.payload.exportId, true)).rejects.toThrow(); expect((await getSettings()).pendingHealthExport).toEqual(next);
});
it('pending元record削除後confirmはskip、同日再作成にも誤適用しない', async () => {
  const saved = await saveMeasurement(date, { weightKg: 100 }); const p = await beginHealthExport(); await db.weights.delete(saved.id);
  const replacement = await saveMeasurement(date, { weightKg: 99 }); await finishHealthExport(p.payload.exportId, true);
  expect((await db.weights.get(replacement.id))?.healthExport).toBeUndefined(); expect((await getSettings()).pendingHealthExport).toBeUndefined();
});
it('0件ではpendingを作成しない', async () => { await expect(beginHealthExport()).rejects.toThrow('未共有'); expect((await getSettings()).pendingHealthExport).toBeUndefined(); });

it('ウエストだけの日は未共有も再共有も0件でpendingを作らない', async () => {
  const saved = await saveMeasurement(date, { waistCm: 98 });
  for (const resend of [false, true]) {
    expect(healthCounts(healthMeasurements([saved], undefined, resend))).toEqual({ days: 0, fields: 0 });
    await expect(beginHealthExport(undefined, resend)).rejects.toThrow('未共有');
  }
  expect(await db.weights.get(saved.id)).toEqual(saved);
});
it('新pending・再共有にウエストを入れず、ウエスト編集で未共有は増えない', async () => {
  const saved = await saveMeasurement(date, { weightKg: 100, bodyFatPercent: 24, waistCm: 98 });
  const p = await beginHealthExport(); expect(p.payload.measurements).toEqual([{ date, weightKg: 100, bodyFatPercent: 24 }]);
  await finishHealthExport(p.payload.exportId, true);
  await saveMeasurement(date, { weightKg: 100, bodyFatPercent: 24, waistCm: 97 });
  const entry = (await db.weights.get(saved.id))!;
  expect(entry.healthExport?.waistCm).toBeUndefined(); expect(healthMeasurements([entry])).toEqual([]);
  expect(healthBatch([entry], 'resend', undefined, true).measurements).toEqual([{ date, weightKg: 100, bodyFatPercent: 24 }]);
});
it('旧pendingのウエストを再試行payloadから除き旧metadataを更新・削除しない', async () => {
  const entry = { ...row(date, { weightKg: 100, waistCm: 98 }), healthExport: { waistCm: { value: 96, exportedAt: stamp } } };
  await db.weights.add(entry);
  const p = pendingHealthExport([entry], 'legacy', stamp);
  const legacy = { ...p, payload: { ...p.payload, measurements: [{ date, weightKg: 100, waistCm: 98 }, { date: '2026-09-16', waistCm: 99 }] } };
  await db.settings.put({ ...await getSettings(), id: 'user', pendingHealthExport: legacy });
  const before = structuredClone(legacy);
  expect(supportedHealthBatch(legacy.payload).measurements).toEqual([{ date, weightKg: 100 }]);
  expect(healthCounts(legacy.payload.measurements)).toEqual({ days: 1, fields: 1 }); expect(legacy).toEqual(before);
  expect(isHealthShared(entry, 'waistCm')).toBe(false);
  await finishHealthExport('legacy', true);
  const saved = (await db.weights.get(entry.id))!;
  expect(saved.healthExport?.waistCm).toEqual(entry.healthExport.waistCm); expect(saved.healthExport?.weightKg?.value).toBe(100); expect(saved.waistCm).toBe(98);
});
it('ウエストだけの旧pendingは送信0件・完了してもmetadataを作らない', async () => {
  const entry = await saveMeasurement(date, { waistCm: 98 });
  const p = pendingHealthExport([entry], 'legacy-waist', stamp);
  p.payload.measurements = [{ date, waistCm: 98 } as typeof p.payload.measurements[number]];
  expect(supportedHealthBatch(p.payload).measurements).toEqual([]);
  await db.settings.put({ ...await getSettings(), id: 'user', pendingHealthExport: p });
  await finishHealthExport(p.payload.exportId, true); expect(await db.weights.get(entry.id)).toEqual(entry);
});

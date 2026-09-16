import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { saveMeasurement } from '../data/measurements';
import { measurementDraft, measurementFields, measurementSpec, type MeasurementValues } from '../domain/measurements';
import { formatDate } from '../domain/date';
import type { WeightEntry } from '../domain/types';
import { NumberField } from './Fields';
import { ActionButton } from './CatalogParts';
export function WeightForm({ date, onSaved }: { date: string; onSaved: () => void }) {
  const loaded = useLiveQuery(async () => ({ entry: await db.weights.where('date').equals(date).first() }), [date]);
  return loaded ? <MeasurementEditor key={date} date={date} entry={loaded.entry} onSaved={onSaved} /> : <p>読み込み中…</p>;
}
function MeasurementEditor({ date, entry, onSaved }: { date: string; entry?: WeightEntry; onSaved: () => void }) {
  const [draft, setDraft] = useState(() => measurementDraft(entry));
  return <div className="form-stack"><p>{formatDate(date)}の身体測定</p><p className="help">最低1項目で保存できます。空欄の項目はこの日の記録から外します。</p>
    {measurementFields.map(field => <NumberField key={field} label={measurementSpec[field].label} unit={measurementSpec[field].unit} value={draft[field]} onChange={value => setDraft(old => ({ ...old, [field]: value }))} max={measurementSpec[field].max} />)}
    <ActionButton action={async () => {
      const values: MeasurementValues = {};
      for (const field of measurementFields) if (draft[field].trim()) values[field] = Number(draft[field]);
      await saveMeasurement(date, values); onSaved();
    }}>身体測定を保存</ActionButton>
  </div>;
}

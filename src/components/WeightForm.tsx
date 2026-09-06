import { useState, type FormEvent } from 'react';
import { saveWeight, storageError } from '../data/repository';
import { formatDate } from '../domain/date';
import { numericError } from '../domain/validation';
import { NumberField, FormError } from './Fields';
export function WeightForm({ date, current, onSaved }: { date: string; current?: number; onSaved: () => void }) {
  const [value, setValue] = useState(current?.toString() ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const validation = value.trim() ? numericError(Number(value), '体重', 500, 1) : '体重を入力してください。';
    if (validation) { setError(validation); return; }
    setBusy(true);
    try { await saveWeight(date, Number(value)); onSaved(); } catch (error) { setError(storageError(error)); } finally { setBusy(false); }
  }
  return <form className="form-stack" noValidate onSubmit={submit}><p className="muted">{formatDate(date)}の体重</p><NumberField label="体重" unit="kg" value={value} onChange={setValue} required min={1} max={500} /><FormError message={error} /><button className="button primary" disabled={busy}>{busy ? '保存中…' : '体重を保存'}</button></form>;
}

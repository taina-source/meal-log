import { useState } from 'react';
import { mealLabels, type MealEntry, type UserSettings } from '../domain/types';
import { deleteMeal, storageError } from '../data/repository';
import { formatDate, localDate, localTime } from '../domain/date';
import { formatNumber } from '../domain/nutrition';
import { FormError } from '../components/Fields';
import { Icon } from '../components/Icon';
export function MealDetail({ entry, settings, onEdit, onDeleted }: { entry: MealEntry; settings: UserSettings; onEdit: () => void; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (busy) return;
    setBusy(true);
    try { await deleteMeal(entry.id); onDeleted(); } catch (error) { setError(storageError(error)); } finally { setBusy(false); }
  }
  return <div className="form-stack"><p className="muted">{formatDate(localDate(new Date(entry.eatenAt)))} · {localTime(new Date(entry.eatenAt))} · {mealLabels[entry.mealType]}</p>{entry.restaurant && <p>{entry.restaurant}</p>}<h3 className="detail-name">{entry.name}</h3><p className="detail-calories">{formatNumber(entry.calories)} <span>kcal</span></p><dl className="detail-pfc">{([['P たんぱく質', entry.protein], ['F 脂質', entry.fat], ['C 炭水化物', entry.carbs]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{formatNumber(value, settings.showPfcDecimals)} g</dd></div>)}</dl><p className="help">入力方法：手入力</p><FormError message={error} />{confirm ? <div className="delete-confirm" role="alert"><h3>この食事を削除しますか？</h3><p>「{entry.name}」を削除します。この操作は取り消せません。</p><div className="two-columns"><button className="button secondary" disabled={busy} onClick={() => setConfirm(false)}>キャンセル</button><button className="button danger" disabled={busy} onClick={remove}>{busy ? '削除中…' : '削除する'}</button></div></div> : <><button className="button primary" onClick={onEdit}><Icon name="edit" size={18} />編集する</button><button className="button danger-subtle" onClick={() => setConfirm(true)}><Icon name="trash" size={18} />この食事を削除</button></>}</div>;
}

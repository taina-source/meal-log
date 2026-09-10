import { validateChatgptMeal } from '../domain/chatgpt';
import { useState, type FormEvent } from 'react';
import { mealLabels, mealTypes, type MealEntry, type MealInput, type MealType } from '../domain/types';
import { localDate, localTime } from '../domain/date';
import { validLocalDateTime, validateMeal } from '../domain/validation';
import { saveMeal, storageError } from '../data/repository';
import { NumberField, FormError } from '../components/Fields';
export function MealForm({ date, initialType, initialTime, entry, onSaved }: { date: string; initialType: MealType; initialTime?: string; entry?: MealEntry; onSaved: (date: string) => void }) {
  const [mealType, setMealType] = useState(entry?.mealType ?? initialType);
  const [name, setName] = useState(entry?.name ?? '');
  const [calories, setCalories] = useState(entry?.calories.toString() ?? '');
  const [protein, setProtein] = useState(entry?.protein.toString() ?? '');
  const [fat, setFat] = useState(entry?.fat.toString() ?? '');
  const [carbs, setCarbs] = useState(entry?.carbs.toString() ?? '');
  const [eatenDate, setEatenDate] = useState(entry ? localDate(new Date(entry.eatenAt)) : date);
  const [time, setTime] = useState(entry ? localTime(new Date(entry.eatenAt)) : initialTime ?? localTime());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!calories.trim()) { setError('カロリーを入力してください。0 kcalでも登録できます。'); return; }
    if (entry?.chatgptSnapshot && [protein, fat, carbs].some(value => !value.trim())) { setError('ChatGPT取り込みのPFCは未入力のまま保存できません。'); return; }
    if (!validLocalDateTime(eatenDate, time)) { setError('日付・時刻を正しく入力してください（1900〜2100年）。'); return; }
    const input: MealInput = { name, calories: Number(calories), protein: Number(protein || 0), fat: Number(fat || 0), carbs: Number(carbs || 0), mealType, eatenAt: new Date(`${eatenDate}T${time}:00`).toISOString() };
    const validation = entry?.chatgptSnapshot ? validateChatgptMeal(input) : validateMeal(input);
    if (validation) { setError(validation); return; }
    setBusy(true);
    try { await saveMeal(input, entry?.id); onSaved(eatenDate); } catch (error) { setError(storageError(error)); } finally { setBusy(false); }
  }
  return <form className="form-stack" noValidate onSubmit={submit}>
    <fieldset className="segment-field"><legend className="sr-only">食事区分</legend><div className="segmented">{mealTypes.map(type => <button type="button" key={type} aria-pressed={mealType === type} className={mealType === type ? 'selected' : ''} onClick={() => setMealType(type)}>{mealLabels[type]}</button>)}</div></fieldset>
    <div><p className="eyebrow">{entry?.chatgptSnapshot ? "CHATGPT IMPORT" : "MANUAL ENTRY"}</p><h3>{entry?.chatgptSnapshot ? "ChatGPT取り込みを編集" : "手動で食事を追加"}</h3><p className="help">{entry?.chatgptSnapshot ? "数量を反映した合計値を編集します。元のChatGPT情報は残ります。" : "わかる栄養素だけで大丈夫です。"}</p></div>
    <label className="field"><span>食事名<span className="required">必須</span></span><input value={name} onChange={event => setName(event.target.value)} maxLength={100} required placeholder="例：鶏むね肉とご飯" autoComplete="off" /></label>
    <NumberField label="カロリー" unit="kcal" value={calories} onChange={setCalories} required max={entry?.chatgptSnapshot ? Number.MAX_VALUE : 20000} />
    <div className="form-pfc"><NumberField label="P たんぱく質" unit="g" value={protein} onChange={setProtein} required={!!entry?.chatgptSnapshot} max={entry?.chatgptSnapshot ? Number.MAX_VALUE : 2000} /><NumberField label="F 脂質" unit="g" value={fat} onChange={setFat} required={!!entry?.chatgptSnapshot} max={entry?.chatgptSnapshot ? Number.MAX_VALUE : 2000} /><NumberField label="C 炭水化物" unit="g" value={carbs} onChange={setCarbs} required={!!entry?.chatgptSnapshot} max={entry?.chatgptSnapshot ? Number.MAX_VALUE : 2000} /></div>
    <p className="help compact">{entry?.chatgptSnapshot ? "PFCもすべて入力してください。不明なまま保存できません。" : "PFCは空欄の場合、0gで保存します。"}</p>
    <div className="two-columns"><label className="field"><span>日付</span><input aria-label="日付" type="date" min="1900-01-01" max="2100-12-31" value={eatenDate} onChange={event => setEatenDate(event.target.value)} required /></label><label className="field"><span>時刻</span><input aria-label="時刻" type="time" value={time} onChange={event => setTime(event.target.value)} required /></label></div>
    <FormError message={error} /><button className="button primary" disabled={busy}>{busy ? '保存中…' : entry ? '変更を保存' : '食事を保存'}</button><p className="local-note">この端末に保存されます</p>
  </form>;
}

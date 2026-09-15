import { useState } from 'react';
import type { MealEntry } from '../../domain/types';
import type { MealContext } from '../../data/catalogRepository';
import { reuseSavedMeals } from '../../data/reuseMeals';
import { ActionButton, NutrientSummary } from '../../components/CatalogParts';
import { NumberField } from '../../components/Fields';
import { sumNutrients } from '../../domain/nutrition';
import { ChatgptOriginal } from '../../components/ChatgptSource';
export function ReuseMeals({ entries, context, onSaved }: { entries: MealEntry[]; context: MealContext; onSaved: (date: string) => void }) {
  const [drafts, setDrafts] = useState(() => entries.map(entry => ({ name: entry.name, restaurant: entry.restaurant, calories: String(entry.calories), protein: String(entry.protein), fat: String(entry.fat), carbs: String(entry.carbs), quantity: entry.quantity?.toString() ?? '' })));
  const values = drafts.map((draft, i) => ({ ...entries[i], name: draft.name, restaurant: draft.restaurant, calories: Number(draft.calories), protein: Number(draft.protein), fat: Number(draft.fat), carbs: Number(draft.carbs), quantity: draft.quantity === '' ? undefined : Number(draft.quantity) }));
  const update = (i: number, key: keyof typeof drafts[number], value: string) => setDrafts(current => current.map((draft, j) => i === j ? { ...draft, [key]: value } : draft));
  return <div className="form-stack"><h3>保存した食事を再登録</h3><p className="help">前回の最終保存値です。kcal/PFCは数量を含む合計値で、数量変更だけでは再計算しません。元履歴・お気に入りは変更しません。</p>
    {drafts.map((draft, i) => <section className="form-stack card settings-card" aria-label={`再登録 ${i + 1}品目`} key={entries[i].id}><label className="field"><span>食事名</span><input value={draft.name} maxLength={100} onChange={e => update(i, 'name', e.target.value)} /></label><label className="field"><span>店名</span><input value={draft.restaurant} maxLength={200} onChange={e => update(i, 'restaurant', e.target.value)} /></label>
      {(['calories', 'protein', 'fat', 'carbs'] as const).map((key, j) => <NumberField key={key} label={['カロリー', 'P たんぱく質', 'F 脂質', 'C 炭水化物'][j]} unit={key === 'calories' ? 'kcal' : 'g'} value={draft[key]} required onChange={value => update(i, key, value)} max={Number.MAX_VALUE} />)}
      {entries[i].quantity !== undefined && <NumberField label="数量" unit={entries[i].chatgptUnit ?? entries[i].unit ?? ''} value={draft.quantity} required onChange={value => update(i, 'quantity', value)} max={Number.MAX_VALUE} />}
      {entries[i].chatgptSnapshot && <details><summary>元のChatGPT出典・メモ</summary><ChatgptOriginal snapshot={entries[i].chatgptSnapshot!} modified={entries[i].chatgptUserModified} modifiedBeforeSave={entries[i].chatgptModifiedBeforeSave} /></details>}
    </section>)}
    <NutrientSummary value={sumNutrients(values)} label={`${entries.length}品の合計`} />
    <ActionButton action={async () => { if (drafts.some((d, i) => !d.calories.trim() || !d.protein.trim() || !d.fat.trim() || !d.carbs.trim() || (entries[i].quantity !== undefined && !d.quantity.trim()))) throw new Error('数量・栄養値を入力してください。'); await reuseSavedMeals(entries, values, context); onSaved(context.date); }}>確認して再登録</ActionButton>
  </div>;
}

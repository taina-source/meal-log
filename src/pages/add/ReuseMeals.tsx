import { useState } from 'react';
import type { MealEntry } from '../../domain/types';
import type { MealContext } from '../../data/catalogRepository';
import { reuseSavedMeals } from '../../data/reuseMeals';
import { ActionButton, NutrientSummary } from '../../components/CatalogParts';
import { NumberField, FormError } from '../../components/Fields';
import { reuseFactor, scaleSavedPortion, maxReuseFactor, maxReuseQuantity } from '../../domain/reusePortions';
import { sumNutrients } from '../../domain/nutrition';
import { ChatgptOriginal } from '../../components/ChatgptSource';
export function ReuseMeals({ entries, context, onSaved }: { entries: MealEntry[]; context: MealContext; onSaved: (date: string) => void }) {
  const selectable = entries.length > 1 && entries.every(entry => entry.sourceType === 'chatgpt' && entry.chatgptImportId === entries[0].chatgptImportId);
  const [selected, setSelected] = useState(() => entries.map(() => true));
  const [drafts, setDrafts] = useState(() => entries.map(entry => ({ name: entry.name, restaurant: entry.restaurant, calories: entry.calories == null ? '' : String(entry.calories), protein: entry.protein == null ? '' : String(entry.protein), fat: entry.fat == null ? '' : String(entry.fat), carbs: entry.carbs == null ? '' : String(entry.carbs), quantity: entry.quantity?.toString() ?? '1', error: '' })));
  const values = drafts.map((draft, i) => ({ ...entries[i], name: draft.name, restaurant: draft.restaurant, calories: draft.calories.trim() ? Number(draft.calories) : NaN, protein: draft.protein.trim() ? Number(draft.protein) : NaN, fat: draft.fat.trim() ? Number(draft.fat) : NaN, carbs: draft.carbs.trim() ? Number(draft.carbs) : NaN, quantity: entries[i].quantity === undefined ? undefined : Number(draft.quantity) }));
  const chosen = entries.map((_, i) => i).filter(i => !selectable || selected[i]);
  const valid = chosen.length > 0 && chosen.every(i => { const d = drafts[i]; return !d.error && [d.calories, d.protein, d.fat, d.carbs].every(v => v.trim() && Number.isFinite(Number(v)) && Number(v) >= 0); });
  function changeAmount(i: number, input: string) {
    setDrafts(current => current.map((draft, j) => {
      if (i !== j) return draft;
      try {
        const value = scaleSavedPortion(entries[i], reuseFactor(entries[i].quantity, input));
        return { ...draft, quantity: input, error: '', calories: value.calories == null ? '' : String(value.calories), protein: value.protein == null ? '' : String(value.protein), fat: value.fat == null ? '' : String(value.fat), carbs: value.carbs == null ? '' : String(value.carbs) };
      } catch (error) { return { ...draft, quantity: input, error: error instanceof Error ? error.message : '量を確認してください。' }; }
    }));
  }
  const update = (i: number, key: keyof typeof drafts[number], value: string) => setDrafts(current => current.map((draft, j) => i === j ? { ...draft, [key]: value } : draft));
  return <div className="form-stack"><h3>保存した食事を再登録</h3><p className="help">量を変えると、前回の保存済み合計kcal/PFCから比例計算します。栄養値を直接修正した後に量を変える場合も、前回の保存値から計算し直します。元履歴・お気に入り・元の出典snapshotは変更しません。不明の栄養値は入力してから登録してください。</p>
    {selectable && <section className="form-stack" aria-label="登録する食品を選択"><h3>登録する食品を選択</h3><p className="help">{chosen.length} / {entries.length}品選択中。1品以上選択してください。全品を選ぶとまとめて再登録できます。</p><div className="two-columns"><button className="button secondary" onClick={() => setSelected(entries.map(() => true))}>すべて選択</button><button className="button secondary" onClick={() => setSelected(entries.map(() => false))}>すべて解除</button></div></section>}
    {drafts.map((draft, i) => <section className="form-stack card settings-card" aria-label={`再登録 ${i + 1}品目`} key={entries[i].id}>
      {selectable && <label style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={selected[i]} onChange={e => { const checked = e.target.checked; setSelected(current => current.map((value, j) => i === j ? checked : value)); }} /><span>{entries[i].name}を登録</span></label>}
      <p className="help">{entries[i].name} · 前回量：{entries[i].quantity ?? 1}{entries[i].chatgptUnit ?? entries[i].unit ?? '回分'} · {entries[i].calories ?? '不明'} kcal</p>
      {(!selectable || selected[i]) && <><label className="field"><span>食事名</span><input value={draft.name} maxLength={100} onChange={e => update(i, 'name', e.target.value)} /></label><label className="field"><span>店名</span><input value={draft.restaurant} maxLength={200} onChange={e => update(i, 'restaurant', e.target.value)} /></label>
      <NumberField label={entries[i].quantity === undefined ? '前回量に対する倍率' : '今回の数量'} unit={entries[i].quantity === undefined ? '倍' : entries[i].chatgptUnit ?? entries[i].unit ?? ''} value={draft.quantity} required onChange={value => changeAmount(i, value)} max={entries[i].quantity === undefined ? maxReuseFactor : maxReuseQuantity} />
      <FormError message={draft.error} />
      {(['calories', 'protein', 'fat', 'carbs'] as const).map((key, j) => <NumberField key={key} label={['カロリー', 'P たんぱく質', 'F 脂質', 'C 炭水化物'][j]} unit={key === 'calories' ? 'kcal' : 'g'} value={draft[key]} required onChange={value => update(i, key, value)} max={Number.MAX_VALUE} />)}
      {entries[i].chatgptSnapshot && <details><summary>元のChatGPT出典・メモ</summary><ChatgptOriginal snapshot={entries[i].chatgptSnapshot!} modified={entries[i].chatgptUserModified} modifiedBeforeSave={entries[i].chatgptModifiedBeforeSave} /></details>}
    </>}</section>)}
    {valid && <NutrientSummary value={sumNutrients(chosen.map(i => values[i]))} label={`${chosen.length}品の合計`} />}
    <ActionButton disabled={!valid} action={async () => { chosen.forEach(i => reuseFactor(entries[i].quantity, drafts[i].quantity)); await reuseSavedMeals(chosen.map(i => entries[i]), chosen.map(i => values[i]), context); onSaved(context.date); }}>確認して再登録</ActionButton>
  </div>;
}

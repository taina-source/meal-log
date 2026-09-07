import { useState } from 'react';
import { NumberField } from '../../components/Fields';
import { ActionButton } from '../../components/CatalogParts';
import { quickEntry, type MealContext } from '../../data/catalogRepository';
export function QuickEntry({ context, onSaved }: { context: MealContext; onSaved: (date: string) => void }) {
  const [calories, setCalories] = useState(''), [name, setName] = useState('');
  return <div className="form-stack"><h3>かんたん入力</h3><p className="help">詳しい内容がわからないときは、カロリーだけ記録。</p><NumberField label="カロリー" unit="kcal" required max={20000} value={calories} onChange={setCalories} /><label className="field"><span>食事名（任意）</span><input value={name} maxLength={100} placeholder="空欄なら「かんたん入力」" onChange={event => setName(event.target.value)} /></label><p className="help">P・F・Cは0gで保存します。</p><ActionButton action={async () => { if (!calories.trim()) throw new Error('カロリーを入力してください。'); await quickEntry(Number(calories), name, context); onSaved(context.date); }}>カロリーを記録</ActionButton></div>;
}

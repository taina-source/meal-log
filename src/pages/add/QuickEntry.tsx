import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FormError, NumberField } from '../../components/Fields';
import { ActionButton, NutrientSummary } from '../../components/CatalogParts';
import { quickEntry, saveQuickPercentages, type MealContext } from '../../data/catalogRepository';
import { getSettings, storageError } from '../../data/repository';
import { quickNutrition, quickPercentages, type QuickPfc } from '../../domain/quickNutrition';
import { formatNumber } from '../../domain/nutrition';
import type { UserSettings } from '../../domain/types';
type Props = { context: MealContext; onSaved: (date: string) => void };
export function QuickEntry(props: Props) {
  const settings = useLiveQuery(getSettings, []);
  return settings ? <QuickForm {...props} settings={settings} /> : <p role="status">設定を読み込み中…</p>;
}
function QuickForm({ context, onSaved, settings }: Props & { settings: UserSettings }) {
  const [calories, setCalories] = useState(''), [name, setName] = useState('');
  const [mode, setMode] = useState<QuickPfc['mode']>('percent');
  const [percent, setPercent] = useState(() => { const p = quickPercentages(settings); return { protein: String(p.protein), fat: String(p.fat), carbs: String(p.carbs) }; });
  const [grams, setGrams] = useState({ protein: '0', fat: '0', carbs: '0' });
  const [saveError, setSaveError] = useState('');
  function input(): QuickPfc {
    if (mode === 'none') return { mode };
    const values = mode === 'percent' ? percent : grams;
    if (Object.values(values).some(value => !value.trim())) throw new Error('PFCを入力してください。0も指定できます。');
    return { mode, values: { protein: Number(values.protein), fat: Number(values.fat), carbs: Number(values.carbs) } };
  }
  let preview: ReturnType<typeof quickNutrition> | undefined, error = '';
  try { if (calories.trim()) preview = quickNutrition(Number(calories), input()); } catch (reason) { error = storageError(reason); }
  async function remember() {
    if (mode !== 'percent') return;
    try { const p = input(); quickNutrition(0, p); if (p.mode === 'percent') await saveQuickPercentages(p.values); setSaveError(''); }
    catch (reason) { setSaveError(storageError(reason)); }
  }
  return <div className="form-stack"><h3>かんたん入力</h3><p className="help">カロリーを入力し、PFCをざっくり記録できます。</p>
    <NumberField label="カロリー" unit="kcal" required max={20000} value={calories} onChange={setCalories} />
    <label className="field"><span>食事名（任意）</span><input value={name} maxLength={100} placeholder="空欄なら「かんたん入力」" onChange={event => setName(event.target.value)} /></label>
    <fieldset className="segment-field"><legend>PFC入力方法</legend><div className="segmented">{(['percent','grams','none'] as const).map((value,i) => <button type="button" key={value} aria-pressed={mode === value} className={mode === value ? 'selected' : ''} onClick={() => setMode(value)}>{['割合（%）','グラム','PFCを入力しない'][i]}</button>)}</div></fieldset>
    {mode !== 'none' && <div className="form-pfc" onBlur={() => { void remember(); }}>{(['protein','fat','carbs'] as const).map((key,i) => <NumberField key={key} label={['P たんぱく質','F 脂質','C 炭水化物'][i]} unit={mode === 'percent' ? '%' : 'g'} max={mode === 'percent' ? 100 : 2000} value={(mode === 'percent' ? percent : grams)[key]} onChange={value => mode === 'percent' ? setPercent(current => ({ ...current, [key]: value })) : setGrams(current => ({ ...current, [key]: value }))} />)}</div>}
    {mode === 'percent' && <p className="help">総カロリーに占めるエネルギー比率です。自動で100%には補正しません。入力欄を離れると有効な割合を次回用に保存します。</p>}
    {mode === 'none' && <p className="help">P・F・Cは0gで保存し、PFC分析でも0gとして扱われます。</p>}
    {preview && <><NutrientSummary value={preview.nutrients} label="保存する栄養値" />{mode === 'percent' && <p>割合の合計 {formatNumber(preview.percentTotal!, true)}%</p>}{mode === 'grams' && <p className="help">PFCから計算したカロリー（4/9/4）：{formatNumber(preview.pfcCalories, true)} kcal<br />入力カロリーとの差：{preview.difference > 0 ? '+' : ''}{formatNumber(preview.difference, true)} kcal</p>}{preview.warning && <p className="catalog-note" role="status">{preview.warning}</p>}</>}
    <FormError message={error || saveError} />
    <ActionButton action={async () => { if (!calories.trim()) throw new Error('カロリーを入力してください。'); await quickEntry(Number(calories), name, context, input()); onSaved(context.date); }}>食事を記録</ActionButton>
  </div>;
}
